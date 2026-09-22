import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as ha from './ha';

// Mock the HA connection layer
vi.mock('./ha', async () => {
  const actual = await vi.importActual<typeof import('./ha')>('./ha');
  return {
    ...actual,
    getHaConnection: vi.fn(),
    sendMqttCommand: vi.fn().mockResolvedValue(undefined),
    setEntityState: vi.fn().mockResolvedValue(undefined),
    subscribeMqttTopic: vi.fn().mockResolvedValue(() => Promise.resolve()),
    fetchSensorHistory: vi.fn().mockResolvedValue({}),
  };
});

describe('Grow Wardrobe Frontend', () => {
  const mockConn = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
    (ha.getHaConnection as any).mockImplementation((onEntities: any) => {
      // Simulate initial entities
      setTimeout(() => {
        onEntities({
          'binary_sensor.esp32_growdrobe_status': { state: 'on' },
          'sensor.esp32_growdrobe_canopy_temp': { state: '24.5' },
          'sensor.esp32_growdrobe_canopy_humidity': { state: '58.2' },
          'sensor.esp32_growdrobe_canopy_vpd': { state: '1.25' },
          'sensor.esp32_growdrobe_pot_temp': { state: '21.0' },
          'sensor.esp32_growdrobe_pot_humidity': { state: '65.4' },
          'sensor.esp32_growdrobe_pot_vpd': { state: '0.85' },
          'sensor.esp32_growdrobe_ambient_temp': { state: '19.8' },
          'sensor.esp32_growdrobe_ambient_humidity': { state: '51.0' },
          'sensor.esp32_growdrobe_moisture': { state: '38.0' },
          'number.ventilation_fan_speed': { state: '45' },
          'select.ventilation_mode': { state: 'AUTO' },
          'select.irrigation_mode': { state: 'AUTO' },
          'switch.grow_light': { state: 'off' },
          'switch.drip_pump': { state: 'off' },
          'switch.agitation_pump': { state: 'off' },
          'switch.waste_pump': { state: 'off' },
        });
      }, 0);

      return Promise.resolve({
        connection: mockConn,
        isEmbedded: true,
      });
    });
  });

  it('renders environment metrics across all three zones (Canopy, Pot, Ambient)', async () => {
    render(<App />);

    await waitFor(() => {
      // Canopy
      expect(screen.getByText('24.5')).toBeInTheDocument();
      expect(screen.getByText('58.2')).toBeInTheDocument();
      expect(screen.getByText('1.25')).toBeInTheDocument();

      // Pot
      expect(screen.getByText('21.0')).toBeInTheDocument();
      expect(screen.getByText('65.4')).toBeInTheDocument();
      expect(screen.getByText('0.85')).toBeInTheDocument();
      expect(screen.getByText(/Moisture: 38.0%/i)).toBeInTheDocument();

      // Ambient
      expect(screen.getByText('19.8')).toBeInTheDocument();
      expect(screen.getByText('51.0')).toBeInTheDocument();
      expect(screen.getByText('1.13')).toBeInTheDocument();
    });
  });

  it('renders Fan Dynamics & Intelligence panel with rationale, speed, and differentials', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Fan Dynamics & Intelligence/i)).toBeInTheDocument();
      expect(screen.getByText(/Why is the fan set to 45%?/i)).toBeInTheDocument();
      expect(screen.queryByText(/Does the difference in VPD define fan speed\?/i)).not.toBeInTheDocument();
      expect(screen.getByText(/1\. Target VPD Demand/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. Intake Moisture Δ/i)).toBeInTheDocument();
      expect(screen.getByText(/3\. Thermal Differential ΔT/i)).toBeInTheDocument();
    });
  });

  it('switches between Coco Coir and Organic Soil strategies correctly', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Default is Coco Coir
    expect(screen.getByText(/Feed Interval \(Hours\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Fertigation Schedule/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Water Now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Schedule Next Feed/i })).toBeInTheDocument();
    expect(screen.queryByText(/Soil Moisture Dynamics/i)).not.toBeInTheDocument();

    // Switch to Organic Soil
    const soilButton = screen.getByRole('button', { name: /Organic Soil/i });
    await user.click(soilButton);

    // Coco inputs disappear and Soil overview appears
    expect(screen.queryByText(/Feed Interval \(Hours\)/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Water Trigger Threshold/i)).toBeInTheDocument();
    expect(screen.getByText(/Target Moisture Level/i)).toBeInTheDocument();
    expect(screen.getByText(/Soil Moisture Dynamics/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Soak Cooldown/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Safety Runoff Cutoff/i).length).toBeGreaterThanOrEqual(1);
  });

  it('triggers immediate watering and schedules next cycle via MQTT', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Water Now/i })).toBeInTheDocument();
    });

    // Test Water Now
    const waterNowBtn = screen.getByRole('button', { name: /Water Now/i });
    await user.click(waterNowBtn);

    expect(ha.sendMqttCommand).toHaveBeenCalledWith(
      mockConn,
      'wardrobe/irrigation/next_cycle/set',
      '0'
    );

    // Open Schedule Next Feed modal
    const scheduleBtn = screen.getByRole('button', { name: /Schedule Next Feed/i });
    await user.click(scheduleBtn);

    expect(screen.getByText(/Schedule Next Feeding/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /In 30m/i })).toBeInTheDocument();

    // Click In 30m
    await user.click(screen.getByRole('button', { name: /In 30m/i }));

    expect(ha.sendMqttCommand).toHaveBeenCalledWith(
      mockConn,
      'wardrobe/irrigation/next_cycle/set',
      '1800'
    );
  });

  it('dispatches correct MQTT command contract when applying Coco strategy', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Apply Strategy to Wardrobe/i })).toBeEnabled();
    });

    const applyButton = screen.getByRole('button', { name: /Apply Strategy to Wardrobe/i });
    await user.click(applyButton);

    expect(ha.sendMqttCommand).toHaveBeenCalledWith(mockConn, 'wardrobe/config/medium/set', 'COCO');
    expect(ha.sendMqttCommand).toHaveBeenCalledWith(mockConn, 'wardrobe/config/coco_interval/set', '4');
    expect(ha.sendMqttCommand).toHaveBeenCalledWith(mockConn, 'wardrobe/config/coco_duration/set', '25');
    expect(ha.sendMqttCommand).toHaveBeenCalledWith(mockConn, 'wardrobe/config/light_preset/set', '18/6');
    expect(ha.sendMqttCommand).toHaveBeenCalledWith(mockConn, 'wardrobe/config/light_start_time/set', '06:00');
  });

  it('dispatches correct MQTT command contract when applying Soil strategy', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Apply Strategy to Wardrobe/i })).toBeEnabled();
    });

    // Switch to Soil
    await user.click(screen.getByRole('button', { name: /Organic Soil/i }));

    const applyButton = screen.getByRole('button', { name: /Apply Strategy to Wardrobe/i });
    await user.click(applyButton);

    expect(ha.sendMqttCommand).toHaveBeenCalledWith(mockConn, 'wardrobe/config/medium/set', 'SOIL');
    expect(ha.sendMqttCommand).toHaveBeenCalledWith(mockConn, 'wardrobe/config/soil_target/set', '45');
    expect(ha.sendMqttCommand).toHaveBeenCalledWith(mockConn, 'wardrobe/config/soil_trigger/set', '28');
    expect(ha.sendMqttCommand).toHaveBeenCalledWith(mockConn, 'wardrobe/config/soil_max_water/set', '60');
    expect(ha.sendMqttCommand).toHaveBeenCalledWith(mockConn, 'wardrobe/config/soil_soak_wait/set', '60');
    expect(ha.sendMqttCommand).toHaveBeenCalledWith(mockConn, 'wardrobe/config/light_preset/set', '18/6');
    expect(ha.sendMqttCommand).toHaveBeenCalledWith(mockConn, 'wardrobe/config/light_start_time/set', '06:00');
  });

  it('enforces safety guard on fan slider when in AUTO mode', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/PI VPD Loop Control/i)).toBeInTheDocument();
    });

    const fanSlider = screen.getByRole('slider');
    expect(fanSlider).toBeDisabled();
    expect(screen.getByText(/Switch ventilation to MANUAL to adjust speed/i)).toBeInTheDocument();
  });

  it('allows switching themes and updates document data-theme attribute', async () => {
    const user = userEvent.setup();
    render(<App />);

    const themeButton = screen.getByRole('button', { name: /Theme selector/i });
    expect(themeButton).toBeInTheDocument();

    await user.click(themeButton);
    expect(screen.getByText(/Forest Dark/i)).toBeInTheDocument();

    await user.click(screen.getByText(/Forest Dark/i));
    expect(document.documentElement.getAttribute('data-theme')).toBe('forest');
    expect(localStorage.getItem('grow_wardrobe_theme')).toBe('forest');
  });

  it('renders photoperiod schedule timeline with active on/off times', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/24-Hour Photoperiod Schedule/i)).toBeInTheDocument();
      expect(screen.getByText(/Lights ON Time/i)).toBeInTheDocument();
      expect(screen.getByText(/Lights OFF Time/i)).toBeInTheDocument();
      expect(screen.getAllByText(/06:00/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/00:00/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders helpful tooltips for soil moisture settings', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText(/Organic Soil/i));

    expect(screen.getByText(/Soak Cooldown \(Minutes\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Safety Max Water Cutoff \(Seconds\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Mandatory rest period after watering/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders historical sensor telemetry chart with dual-axis controls, zones, and time ranges', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Historical Telemetry')).toBeInTheDocument();
      expect(screen.getByText('Synchronized')).toBeInTheDocument();
      expect(screen.getByText(/Temperature Dynamics/i)).toBeInTheDocument();
      expect(screen.getByText(/Humidity & Moisture Dynamics/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /All Zones/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Canopy$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pot & Soil/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Ambient$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '6h' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '24h' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '7d' })).toBeInTheDocument();
    });

    // Test zone filtering
    const canopyFilterBtn = screen.getByRole('button', { name: /^Canopy$/i });
    await user.click(canopyFilterBtn);

    // Test time range selection
    const range12hBtn = screen.getByRole('button', { name: '12h' });
    await user.click(range12hBtn);

    // Series toggles exist
    expect(screen.getByRole('button', { name: /^Canopy Temp/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Canopy RH/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pot Temp/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Soil Moisture/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ambient Temp/i })).toBeInTheDocument();
  });

  it('navigates seamlessly between Sensor Telemetry, Fan Dynamics, and Grow Config tabs', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sensor Telemetry/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Fan Dynamics/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Grow Config & Controls/i })).toBeInTheDocument();
    });

    // Default tab is sensors
    expect(screen.getByText('Historical Telemetry')).toBeVisible();

    // Switch to Fan Dynamics
    const fanTabBtn = screen.getByRole('button', { name: /Fan Dynamics/i });
    await user.click(fanTabBtn);
    expect(screen.getByText(/Why is the fan set to 45%?/i)).toBeVisible();

    // Switch to Grow Config
    const configTabBtn = screen.getByRole('button', { name: /Grow Config & Controls/i });
    await user.click(configTabBtn);
    expect(screen.getByRole('button', { name: /Apply Strategy to Wardrobe/i })).toBeVisible();

    // Switch back to Sensor Telemetry
    const sensorTabBtn = screen.getByRole('button', { name: /Sensor Telemetry/i });
    await user.click(sensorTabBtn);
    expect(screen.getByText('Historical Telemetry')).toBeVisible();
  });
});

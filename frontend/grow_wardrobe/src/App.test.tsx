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
          'sensor.esp32_growdrobe_moisture': { state: '38.0' },
          'number.ventilation_fan_speed': { state: '45' },
          'select.ventilation_mode': { state: 'AUTO' },
          'select.irrigation_mode': { state: 'AUTO' },
          'switch.grow_light': { state: 'off' },
          'switch.drip_pump': { state: 'off' },
          'switch.agitation_pump': { state: 'off' },
        });
      }, 0);

      return Promise.resolve({
        connection: mockConn,
        isEmbedded: true,
      });
    });
  });

  it('renders environment metrics from Home Assistant', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('24.5')).toBeInTheDocument();
      expect(screen.getByText('58.2')).toBeInTheDocument();
      expect(screen.getByText('1.25')).toBeInTheDocument();
      expect(screen.getByText('38.0')).toBeInTheDocument();
    });
  });

  it('switches between Coco Coir and Organic Soil strategies correctly', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Default is Coco Coir
    expect(screen.getByText(/Feed Interval \(Hours\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Estimated Upcoming Feedings/i)).toBeInTheDocument();
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
});

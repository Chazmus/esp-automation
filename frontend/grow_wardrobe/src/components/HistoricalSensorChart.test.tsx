import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HistoricalSensorChart } from './HistoricalSensorChart';

describe('HistoricalSensorChart', () => {
  it('renders correctly with mock connection and entities', () => {
    const mockEntities = {
      'sensor.esp32_growdrobe_canopy_temp': { state: '24.5' },
      'sensor.esp32_growdrobe_canopy_humidity': { state: '58.2' },
    } as any;

    render(<HistoricalSensorChart connection={null} entities={mockEntities} />);
    expect(screen.getByText(/Historical Telemetry/i)).toBeInTheDocument();
  });
});

import { useEffect, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Decimation,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Decimation
);

export default function ChartComparison() {
  const [fullData, setFullData] = useState(null);
  const [decimatedData, setDecimatedData] = useState(null);

  useEffect(() => {
    // Generate sine wave with 40237 points
    const generateSineWave = (numPoints) => {
      const data = [];
      for (let i = 0; i < numPoints; i++) {
        const x = (i / numPoints) * 20 * Math.PI; // 10 complete cycles
        const y = Math.sin(x) + Math.sin(3 * x) * 0.3 + Math.sin(5 * x) * 0.2; // Complex sine wave
        data.push({ x: i, y });
      }
      return data;
    };

    // Remap X values to fit any desired X-axis length
    const remapXAxis = (data, targetXLength) => {
      const originalLength = data.length;
      return data.map((point, index) => ({
        x: (index / originalLength) * targetXLength, // Scale X to fit target length
        y: point.y
      }));
    };

    const full = generateSineWave(40237);
    const remappedTo2000 = remapXAxis(full, 2000);

    setFullData(full);
    setDecimatedData(remappedTo2000);
  }, []);

  if (!fullData || !decimatedData) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const fullChartData = {
    datasets: [
      {
        label: 'Full Data (40,237 points)',
        data: fullData,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        borderWidth: 1,
        pointRadius: 0, // Hide points for performance
        parsing: false, // Better performance
      },
    ],
  };

  const decimatedChartData = {
    datasets: [
      {
        label: 'Decimated Data (2,000 points)',
        data: decimatedData,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderWidth: 1,
        pointRadius: 0,
        parsing: false,
      },
    ],
  };

  const fullChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    animation: false,
    scales: {
      x: {
        type: 'linear',
        min: 0,
        max: 40237,
        title: {
          display: true,
          text: 'Sample Index',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Amplitude',
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      decimation: {
        enabled: false,
        algorithm: 'lttb',
      },
    },
  };

  const decimatedChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    animation: false,
    scales: {
      x: {
        type: 'linear',
        min: 0,
        max: 2000,
        title: {
          display: true,
          text: 'Sample Index',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Amplitude',
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      decimation: {
        enabled: false,
        algorithm: 'lttb',
      },
    },
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4">
          Full Resolution Chart (40,237 points)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          This chart displays all 40,237 data points of a complex sine wave.
        </p>
        <div style={{ height: '400px' }}>
          <Line data={fullChartData} options={fullChartOptions} />
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold mb-4">
          X-Axis Remapped Chart (Still 40,237 points)
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          This chart shows the SAME 40,237 data points, but with X-axis scaled to 0-2000 range.
          All points are preserved, just compressed on the X-axis.
        </p>
        <div style={{ height: '400px' }}>
          <Line data={decimatedChartData} options={decimatedChartOptions} />
        </div>
      </div>

      <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold mb-2">Analysis</h3>
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>
            <strong>Full Data Chart:</strong> {fullData.length.toLocaleString()} points displayed across X-axis 0-40,237
          </li>
          <li>
            <strong>Remapped Chart:</strong> Same {decimatedData.length.toLocaleString()} points displayed across X-axis 0-2,000
          </li>
          <li>
            <strong>Key Difference:</strong> Both charts show ALL the data, but the second chart
            compresses the X-axis by a factor of ~20x
          </li>
          <li>
            This technique allows you to display any size array with any desired X-axis length,
            without losing data points.
          </li>
        </ul>
      </div>
    </div>
  );
}


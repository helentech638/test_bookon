import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartDataPoint {
  date: string;
  revenue: number;
  transactions: number;
  discounts: number;
}

interface FinanceChartProps {
  data: ChartDataPoint[];
  type?: 'line' | 'bar';
  title?: string;
  height?: number;
  showTransactions?: boolean;
  showDiscounts?: boolean;
}

const FinanceChart: React.FC<FinanceChartProps> = ({ 
  data, 
  type = 'line',
  title = "Financial Overview",
  height = 300,
  showTransactions = false,
  showDiscounts = false
}) => {
  const labels = data.map(item => {
    const date = new Date(item.date);
    return date.toLocaleDateString('en-GB', { 
      month: 'short', 
      day: 'numeric' 
    });
  });

  const datasets = [
    {
      label: 'Revenue',
      data: data.map(item => item.revenue),
      borderColor: '#00806a',
      backgroundColor: 'rgba(0, 128, 106, 0.1)',
      borderWidth: 3,
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#00806a',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointRadius: 6,
      pointHoverRadius: 8,
    }
  ];

  if (showTransactions) {
    datasets.push({
      label: 'Transactions',
      data: data.map(item => item.transactions),
      borderColor: '#3B82F6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 2,
      fill: false,
      tension: 0.4,
      pointBackgroundColor: '#3B82F6',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
    });
  }

  if (showDiscounts) {
    datasets.push({
      label: 'Discounts',
      data: data.map(item => item.discounts),
      borderColor: '#EF4444',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderWidth: 2,
      fill: false,
      tension: 0.4,
      pointBackgroundColor: '#EF4444',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
    });
  }

  const chartData = {
    labels,
    datasets
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: datasets.length > 1,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12
          }
        }
      },
      title: {
        display: !!title,
        text: title,
        font: {
          size: 16,
          weight: 'bold' as const
        },
        color: '#374151'
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#00806a',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            
            if (label === 'Transactions') {
              return `${label}: ${value}`;
            } else {
              return `${label}: £${value.toLocaleString()}`;
            }
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#6B7280',
          font: {
            size: 12
          }
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(107, 114, 128, 0.1)'
        },
        ticks: {
          color: '#6B7280',
          font: {
            size: 12
          },
          callback: function(value: any) {
            if (showTransactions && datasets.length > 1) {
              // For mixed charts, show both currency and count
              return typeof value === 'number' && value > 1000 ? `£${value.toLocaleString()}` : value.toString();
            }
            return `£${value.toLocaleString()}`;
          }
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const
    }
  };

  if (data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-50 rounded-lg"
        style={{ height: `${height}px` }}
      >
        <div className="text-center">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">No financial data available</p>
        </div>
      </div>
    );
  }

  const ChartComponent = type === 'bar' ? Bar : Line;

  return (
    <div style={{ height: `${height}px` }}>
      <ChartComponent data={chartData} options={options} />
    </div>
  );
};

export default FinanceChart;










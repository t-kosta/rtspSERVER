import { useEffect, useState } from 'react';
import axios from 'axios';
import { VideoCameraIcon, RectangleGroupIcon, UsersIcon, PlayCircleIcon } from '@heroicons/react/24/outline';

interface Stats {
  totalUsers: number;
  totalInputStreams: number;
  totalOutputStreams: number;
  activeStreams: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalInputStreams: 0,
    totalOutputStreams: 0,
    activeStreams: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await axios.get('/api/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const cards = [
    {
      name: 'Total Input Streams',
      value: stats.totalInputStreams,
      icon: VideoCameraIcon,
      color: 'bg-blue-500',
    },
    {
      name: 'Total Output Streams',
      value: stats.totalOutputStreams,
      icon: RectangleGroupIcon,
      color: 'bg-green-500',
    },
    {
      name: 'Active Streams',
      value: stats.activeStreams,
      icon: PlayCircleIcon,
      color: 'bg-purple-500',
    },
    {
      name: 'Total Users',
      value: stats.totalUsers,
      icon: UsersIcon,
      color: 'bg-yellow-500',
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card) => (
          <div key={card.name} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`${card.color} p-3 rounded-lg`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{card.name}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Welcome to RTSP Relay Server</h2>
        <div className="prose max-w-none">
          <p className="text-gray-600">
            This server allows you to connect multiple RTSP input streams and create composite output streams with
            various layouts.
          </p>
          <h3 className="text-lg font-semibold mt-4 mb-2">Features:</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-600">
            <li>Connect up to 50 input RTSP streams</li>
            <li>Create custom output layouts (2x2, 3x3, 4x4, etc.)</li>
            <li>Real-time stream monitoring via WebSocket</li>
            <li>Multi-user support with role-based access control</li>
            <li>Easy-to-use web interface</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

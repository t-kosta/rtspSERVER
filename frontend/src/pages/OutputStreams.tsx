import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PlusIcon, TrashIcon, PlayIcon, StopIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/authStore';

interface OutputStream {
  id: number;
  name: string;
  layoutName: string;
  gridRows: number;
  gridCols: number;
  outputPort: number | null;
  outputUrl: string | null;
  resolution: string;
  framerate: number;
  bitrate: string;
  status: string;
  lastError: string | null;
  createdBy: string;
}

interface Layout {
  id: number;
  name: string;
  gridRows: number;
  gridCols: number;
  totalSlots: number;
  description: string;
}

interface InputStream {
  id: number;
  name: string;
}

interface Mapping {
  id: number;
  inputStreamId: number;
  inputName: string;
  slotPosition: number;
}

export default function OutputStreams() {
  const [streams, setStreams] = useState<OutputStream[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [inputStreams, setInputStreams] = useState<InputStream[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [selectedStream, setSelectedStream] = useState<number | null>(null);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    layoutTemplateId: '',
    resolution: '1920x1080',
    framerate: 25,
    bitrate: '2000k',
  });
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    loadStreams();
    loadLayouts();
    loadInputStreams();
  }, []);

  const loadStreams = async () => {
    try {
      const response = await axios.get('/api/streams/output');
      setStreams(response.data.streams);
    } catch (error) {
      toast.error('Failed to load output streams');
    }
  };

  const loadLayouts = async () => {
    try {
      const response = await axios.get('/api/streams/layouts');
      setLayouts(response.data.layouts);
    } catch (error) {
      toast.error('Failed to load layouts');
    }
  };

  const loadInputStreams = async () => {
    try {
      const response = await axios.get('/api/streams/input');
      setInputStreams(response.data.streams);
    } catch (error) {
      toast.error('Failed to load input streams');
    }
  };

  const loadMappings = async (streamId: number) => {
    try {
      const response = await axios.get(`/api/streams/output/${streamId}/mappings`);
      setMappings(response.data.mappings);
    } catch (error) {
      toast.error('Failed to load mappings');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/streams/output', formData);
      toast.success('Output stream created successfully');
      setShowCreateModal(false);
      setFormData({ name: '', layoutTemplateId: '', resolution: '1920x1080', framerate: 25, bitrate: '2000k' });
      loadStreams();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create output stream');
    }
  };

  const handleStart = async (id: number) => {
    try {
      await axios.post(`/api/streams/output/${id}/start`);
      toast.success('Output stream started successfully');
      loadStreams();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to start output stream');
    }
  };

  const handleStop = async (id: number) => {
    try {
      await axios.post(`/api/streams/output/${id}/stop`);
      toast.success('Output stream stopped successfully');
      loadStreams();
    } catch (error) {
      toast.error('Failed to stop output stream');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this output stream?')) return;

    try {
      await axios.delete(`/api/streams/output/${id}`);
      toast.success('Output stream deleted successfully');
      loadStreams();
    } catch (error) {
      toast.error('Failed to delete output stream');
    }
  };

  const openMappingModal = async (streamId: number) => {
    setSelectedStream(streamId);
    await loadMappings(streamId);
    setShowMappingModal(true);
  };

  const handleAddMapping = async (inputStreamId: number, slotPosition: number) => {
    if (!selectedStream) return;

    try {
      await axios.post('/api/streams/mappings', {
        outputStreamId: selectedStream,
        inputStreamId,
        slotPosition,
      });
      toast.success('Mapping added successfully');
      loadMappings(selectedStream);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add mapping');
    }
  };

  const handleRemoveMapping = async (mappingId: number) => {
    try {
      await axios.delete(`/api/streams/mappings/${mappingId}`);
      toast.success('Mapping removed successfully');
      if (selectedStream) loadMappings(selectedStream);
    } catch (error) {
      toast.error('Failed to remove mapping');
    }
  };

  const canManage = user?.role === 'admin' || user?.role === 'manager';
  const selectedStreamData = streams.find(s => s.id === selectedStream);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Output Streams</h1>
        {canManage && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Create Output Stream
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {streams.map((stream) => (
          <div key={stream.id} className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{stream.name}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Layout: {stream.layoutName} ({stream.gridRows}x{stream.gridCols})
                </p>
                <p className="text-sm text-gray-500">
                  Resolution: {stream.resolution} @ {stream.framerate}fps | Bitrate: {stream.bitrate}
                </p>
                {stream.outputUrl && (
                  <p className="text-sm text-gray-600 mt-2 font-mono">{stream.outputUrl}</p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    stream.status === 'running'
                      ? 'bg-green-100 text-green-800'
                      : stream.status === 'error'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {stream.status}
                </span>
              </div>
            </div>

            {canManage && (
              <div className="mt-4 flex space-x-3">
                <button
                  onClick={() => openMappingModal(stream.id)}
                  className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                >
                  <Cog6ToothIcon className="h-4 w-4 mr-1" />
                  Configure
                </button>
                {stream.status !== 'running' ? (
                  <button
                    onClick={() => handleStart(stream.id)}
                    className="flex items-center px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                  >
                    <PlayIcon className="h-4 w-4 mr-1" />
                    Start
                  </button>
                ) : (
                  <button
                    onClick={() => handleStop(stream.id)}
                    className="flex items-center px-3 py-1 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm"
                  >
                    <StopIcon className="h-4 w-4 mr-1" />
                    Stop
                  </button>
                )}
                <button
                  onClick={() => handleDelete(stream.id)}
                  className="flex items-center px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                >
                  <TrashIcon className="h-4 w-4 mr-1" />
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Output Stream</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Layout</label>
                <select
                  required
                  value={formData.layoutTemplateId}
                  onChange={(e) => setFormData({ ...formData, layoutTemplateId: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select layout...</option>
                  {layouts.map((layout) => (
                    <option key={layout.id} value={layout.id}>
                      {layout.name} ({layout.totalSlots} slots)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Resolution</label>
                <select
                  value={formData.resolution}
                  onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="1920x1080">1920x1080 (Full HD)</option>
                  <option value="1280x720">1280x720 (HD)</option>
                  <option value="3840x2160">3840x2160 (4K)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Framerate</label>
                <input
                  type="number"
                  value={formData.framerate}
                  onChange={(e) => setFormData({ ...formData, framerate: parseInt(e.target.value) })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mapping Modal */}
      {showMappingModal && selectedStreamData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold mb-4">
              Configure Mappings: {selectedStreamData.name}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Layout: {selectedStreamData.layoutName} ({selectedStreamData.gridRows}x{selectedStreamData.gridCols} grid)
            </p>

            <div className="mb-4">
              <h3 className="font-semibold mb-2">Current Mappings:</h3>
              <div className="space-y-2">
                {mappings.map((mapping) => (
                  <div key={mapping.id} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                    <span>
                      Slot {mapping.slotPosition}: {mapping.inputName}
                    </span>
                    <button
                      onClick={() => handleRemoveMapping(mapping.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {mappings.length === 0 && (
                  <p className="text-gray-500 text-sm">No mappings configured yet</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Add Mapping:</h3>
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: selectedStreamData.gridRows * selectedStreamData.gridCols }).map((_, index) => {
                  const mapping = mappings.find(m => m.slotPosition === index);
                  return (
                    <div key={index} className="border border-gray-300 rounded p-3">
                      <p className="text-sm font-medium mb-2">Slot {index}</p>
                      {mapping ? (
                        <p className="text-sm text-gray-600">{mapping.inputName}</p>
                      ) : (
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddMapping(parseInt(e.target.value), index);
                              e.target.value = '';
                            }
                          }}
                          className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
                        >
                          <option value="">Select input...</option>
                          {inputStreams.map((input) => (
                            <option key={input.id} value={input.id}>
                              {input.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowMappingModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { sonarr, auth, operations as operationsApi } from '../services/api';
import ActivityHistory from './ActivityHistory';
import SonarrSelector from './SonarrSelector';
import EnhancedProgressBar from './EnhancedProgressBar';
import logoTransparent from '../assets/logotransparent.png';

export default function Activity() {
  const navigate = useNavigate();
  const [instances, setInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [operations, setOperations] = useState([]);

  useEffect(() => {
    loadInstances();
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const response = await auth.getMe();
      setUser(response.data);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadInstances = async () => {
    setLoading(true);
    try {
      const response = await sonarr.getInstances();
      setInstances(response.data);
      if (response.data.length > 0) {
        setSelectedInstance(response.data[0]);
      }
    } catch (error) {
      console.error('Error loading instances:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInstanceChange = (instance) => {
    setSelectedInstance(instance);
  };

  useEffect(() => {
    let intervalId;
    const loadOperations = async () => {
      try {
        const response = await operationsApi.getUserOperations();
        setOperations(response.data.operations || []);
      } catch (error) {
        console.error('Error loading operations:', error);
      }
    };

    loadOperations();
    intervalId = setInterval(loadOperations, 5000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const { queuedShows, activeShows, completedShows } = useMemo(() => {
    const queued = [];
    const active = [];
    const completed = [];

    operations
      .filter(op => op.operation_type === 'season_it_bulk')
      .forEach(op => {
        const completedIds = new Set((op.completed_items || []).map(i => i.id));
        const failedIds = new Set((op.failed_items || []).map(i => i.id));
        const items = op.items || [];

        items.forEach((item, index) => {
          const isCompleted = completedIds.has(item.id) || failedIds.has(item.id);
          const isCurrent =
            op.status === 'running' &&
            op.current_item === index + 1 &&
            !isCompleted;

          const entry = {
            id: item.id,
            name: item.name || `Item ${index + 1}`,
            status: isCompleted ? 'completed' : isCurrent ? 'active' : 'queued',
            operation_status: op.status,
          };

          if (entry.status === 'queued') {
            queued.push(entry);
          } else if (entry.status === 'active') {
            active.push(entry);
          } else {
            completed.push(entry);
          }
        });
      });

    return { queuedShows: queued, activeShows: active, completedShows: completed };
  }, [operations]);

  return (
    <div className="dashboard">
      <div className="dashboard-content">
        <header className="dashboard-header">
          <div className="logo-container" onClick={() => navigate('/')} style={{cursor: 'pointer'}}>
            <img src={logoTransparent} alt="Seasonarr" className="logo" />
            <h1>Seasonarr</h1>
          </div>
          <div className="dashboard-controls">
            <SonarrSelector
              instances={instances}
              selectedInstance={selectedInstance}
              onInstanceChange={handleInstanceChange}
            />
            <button 
              className="settings-btn"
              onClick={() => navigate('/settings')}
            >
              Settings
            </button>
            <button 
              className="dashboard-btn"
              onClick={() => navigate('/')}
            >
              Dashboard
            </button>
            <button className="logout-btn" onClick={() => {
              auth.logout();
              window.location.reload();
            }}>
              Logout
            </button>
          </div>
        </header>

        <div className="activity-page">
          <h2>Activity History</h2>
          {user && <EnhancedProgressBar userId={user.id} />}
          
          <div className="activity-queue-sections">
            <div className="activity-queue-column">
              <h3>In Queue</h3>
              {queuedShows.length === 0 ? (
                <p className="activity-queue-empty">No shows waiting in the queue.</p>
              ) : (
                <ul className="activity-queue-list">
                  {queuedShows.map(show => (
                    <li key={`queued-${show.operation_status}-${show.id}`}>
                      {show.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="activity-queue-column">
              <h3>Active</h3>
              {activeShows.length === 0 ? (
                <p className="activity-queue-empty">No active Season It operations.</p>
              ) : (
                <ul className="activity-queue-list">
                  {activeShows.map(show => (
                    <li key={`active-${show.operation_status}-${show.id}`}>
                      {show.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="activity-queue-column">
              <h3>Completed (recent)</h3>
              {completedShows.length === 0 ? (
                <p className="activity-queue-empty">No recently completed shows.</p>
              ) : (
                <ul className="activity-queue-list">
                  {completedShows.slice(0, 10).map(show => (
                    <li key={`completed-${show.operation_status}-${show.id}`}>
                      {show.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {loading ? (
            <div className="loading">Loading instances...</div>
          ) : (
            <ActivityHistory selectedInstance={selectedInstance} />
          )}
        </div>
      </div>
    </div>
  );
}
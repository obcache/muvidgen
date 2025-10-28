import React from 'react';
import { TimelineProvider } from './context/TimelineContext';
import { InspectorPanel, TimelinePanel } from './components';
import './styles.css';
import './components/TimelinePanel.css';
import './components/InspectorPanel.css';

export const App: React.FC = () => (
  <TimelineProvider>
    <main className="app">
      <TimelinePanel />
      <InspectorPanel />
    </main>
  </TimelineProvider>
);

export default App;

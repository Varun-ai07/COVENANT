self.onmessage = (e) => {
  if (e.data.action === 'fetchTasks') {
    // Simulate task processing in a web worker
    const mockTasks = [
      { id: '#001', title: 'Optimize gas fees', status: 'in-progress' },
      { id: '#002', title: 'Verify attestations', status: 'completed' },
      { id: '#003', title: 'Process agent rewards', status: 'pending' }
    ];
    self.postMessage(mockTasks);
  }
};
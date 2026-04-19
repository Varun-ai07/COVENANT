self.onmessage = (e) => {
  if (e.data.action === 'loadVerificationTasks') {
    const mockTasks = [
      { taskId: '#0042', title: 'Verify smart contract', status: 'completed' },
      { taskId: '#0037', title: 'Check agent signatures', status: 'pending' }
    ];
    self.postMessage(mockTasks);
  }
};
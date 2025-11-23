import { useState } from 'react';
import { runAllWalrusTests, testSimpleUpload, testJsonUpload, testBinaryUpload, quickTest } from '../ghostcontext/walrus-test';
import './WalrusTest.css';

/**
 * Walrus Test Component
 * Use this to test Walrus integration in the browser
 */
const WalrusTest = () => {
  const [output, setOutput] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const addLog = (message: string) => {
    setOutput(prev => [...prev, message]);
  };

  // Override console.log temporarily
  const runWithLogging = async (testFn: () => Promise<any>) => {
    setOutput([]);
    setTesting(true);

    const originalLog = console.log;
    const originalError = console.error;

    try {
      // Capture console output
      console.log = (...args: any[]) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        addLog(message);
        originalLog(...args);
      };

      console.error = (...args: any[]) => {
        const message = '❌ ' + args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        addLog(message);
        originalError(...args);
      };

      await testFn();
      addLog('\n✅ Test completed successfully!');
      
    } catch (error) {
      addLog(`\n❌ Test failed: ${error}`);
    } finally {
      console.log = originalLog;
      console.error = originalError;
      setTesting(false);
    }
  };

  return (
    <div className="walrus-test-container">
      <div className="walrus-test-header">
        <h1>🐋 Walrus Integration Test</h1>
        <p>Test your Walrus connection before using GhostContext</p>
      </div>

      <div className="walrus-test-actions">
        <button
          onClick={() => runWithLogging(quickTest)}
          disabled={testing}
          className="test-button quick"
        >
          ⚡ Quick Test
        </button>

        <button
          onClick={() => runWithLogging(testSimpleUpload)}
          disabled={testing}
          className="test-button simple"
        >
          📝 Test 1: Simple Upload
        </button>

        <button
          onClick={() => runWithLogging(testJsonUpload)}
          disabled={testing}
          className="test-button json"
        >
          📦 Test 2: JSON Upload
        </button>

        <button
          onClick={() => runWithLogging(testBinaryUpload)}
          disabled={testing}
          className="test-button binary"
        >
          🔒 Test 3: Binary Upload
        </button>

        <button
          onClick={() => runWithLogging(runAllWalrusTests)}
          disabled={testing}
          className="test-button all"
        >
          🚀 Run All Tests
        </button>

        <button
          onClick={() => setOutput([])}
          disabled={testing}
          className="test-button clear"
        >
          🗑️ Clear Output
        </button>
      </div>

      <div className="walrus-test-output">
        <div className="output-header">
          <h3>📋 Test Output</h3>
          {testing && <span className="testing-indicator">⏳ Running...</span>}
        </div>
        
        <pre className="output-content">
          {output.length === 0 
            ? '👆 Click a test button to start testing Walrus integration...'
            : output.join('\n')
          }
        </pre>
      </div>

      <div className="walrus-test-info">
        <h3>ℹ️ About These Tests</h3>
        <ul>
          <li><strong>Quick Test:</strong> Fast upload/download verification</li>
          <li><strong>Test 1:</strong> Upload text "The treasure is buried under the palm tree"</li>
          <li><strong>Test 2:</strong> Upload JSON payload with secrets</li>
          <li><strong>Test 3:</strong> Upload encrypted binary data</li>
          <li><strong>Run All:</strong> Execute all tests sequentially</li>
        </ul>

        <div className="walrus-endpoints">
          <h4>🌐 Walrus Endpoints:</h4>
          <p><strong>Publisher:</strong> https://publisher.walrus-testnet.walrus.space</p>
          <p><strong>Aggregator:</strong> https://aggregator.walrus-testnet.walrus.space</p>
        </div>
      </div>
    </div>
  );
};

export default WalrusTest;



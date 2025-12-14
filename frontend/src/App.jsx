import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import io from 'socket.io-client';

function App() {
  const GRID_SIZE = 5;
  const [grid, setGrid] = useState(Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(false)));
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const socketRef = useRef(null);

  // Initialize grid and WebSocket connection
  useEffect(() => {
    // Reset grid
    const newGrid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(false));
    setGrid(newGrid);
    
    // Connect to WebSocket server
    socketRef.current = io('http://localhost:5001');
    
    // Listen for dot appearance events
    socketRef.current.on('dot_appeared', (data) => {
      console.log('Dot appeared:', data);
      const { position } = data;
      const [x, y] = position;
      
      // Show the dot
      const newGrid = [...grid];
      newGrid[x][y] = true;
      setGrid(newGrid);
      
      // Set a timeout to hide the dot if not clicked
      setTimeout(() => {
        setGrid(prevGrid => {
          const updatedGrid = [...prevGrid];
          if (updatedGrid[x][y]) {
            updatedGrid[x][y] = false;
            // Notify server that dot was missed
            socketRef.current.emit('catch_dot', {
              position: [x, y],
              timestamp: new Date().toISOString(),
              event_type: 'dot_missed'
            });
            return updatedGrid;
          }
          return prevGrid;
        });
      }, 2000); // Dot disappears after 2 seconds if not caught
    });
    
    // Listen for game state updates
    socketRef.current.on('game_state_update', (data) => {
      console.log('Game state update:', data);
      setScore(data.score || 0);
      setMisses(data.misses || 0);
      setGameOver(data.game_over || false);
    });
    
    // Clean up WebSocket connection
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Handle cell click
  const handleCellClick = (x, y) => {
    if (gameOver) return;
    
    if (grid[x][y]) {
      // Caught the dot
      const newGrid = [...grid];
      newGrid[x][y] = false;
      setGrid(newGrid);
      
      // Notify server that dot was caught
      socketRef.current.emit('catch_dot', {
        position: [x, y],
        timestamp: new Date().toISOString(),
        event_type: 'dot_caught'
      });
    }
  };

  // Reset game
  const resetGame = () => {
    const newGrid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(false));
    setGrid(newGrid);
    setScore(0);
    setMisses(0);
    setGameOver(false);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Dot Catcher Game</h1>
        <div className="game-stats">
          <div>Score: {score}</div>
          <div>Misses: {misses}</div>
        </div>
        
        <div className="grid-container">
          {grid.map((row, x) => (
            <div key={x} className="grid-row">
              {row.map((cell, y) => (
                <div
                  key={`${x}-${y}`}
                  className={`grid-cell ${cell ? 'dot' : ''}`}
                  onClick={() => handleCellClick(x, y)}
                >
                  {cell && <div className="dot-symbol">●</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
        
        <div className="controls">
          <button onClick={resetGame}>Reset Game</button>
        </div>
        
        {gameOver && (
          <div className="game-over">
            <h2>Game Over!</h2>
            <p>Final Score: {score}</p>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
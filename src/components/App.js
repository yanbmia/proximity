import React from 'react';
import {Routes, Route} from "react-router-dom"
import Home from '../pages/Home';
const App = () => {
    return (
        <Routes>
          <Route path="*" element={
            <div className="bg-ink-900">
              <Home />
            </div>
          } />

        </Routes>
    );
}

export default App;

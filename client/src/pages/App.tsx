
import {
    Route,
    BrowserRouter as Router,
    Routes
} from "react-router-dom";

import Home from './Home';
import Simulation from './Simulation';

function App() {
  
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />}/>
          <Route path="/simulation" element={<Simulation />}/>
        </Routes>
      </div>
    </Router>
  )
}

export default App;

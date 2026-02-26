
import {
  Route,
  BrowserRouter as Router,
  Routes
} from "react-router-dom";

import Simulation from './Simulation';

function App() {
  

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/simulation" element={<Simulation/>}/>
        </Routes>
      </div>
    </Router>
  )
}

export default App;

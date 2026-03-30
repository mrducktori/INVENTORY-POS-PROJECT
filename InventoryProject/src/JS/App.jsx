import { useState } from 'react'
import '../CSS/App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    <header>
      <h1>Inventory Management System</h1>
    </header>
    <nav>
      <ul>
        <li><a href="#home">Home</a></li>
        <li><a href="#products">Products</a></li>
        <li><a href="#inventory">Inventory</a></li>
        <li><a href="#reports">Reports</a></li>
      </ul>
    </nav>
    
      <section id="center">
        
        <div>
          <h1>Get started</h1>
          <p>
            CLICK<code>THIS</code> TEST <code>BUTTON</code>
          </p>
        </div>
        <button
          className="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
      </section>
    </>
  )
}

export default App

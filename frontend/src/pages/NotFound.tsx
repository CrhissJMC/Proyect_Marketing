import { Link } from "react-router-dom";
import { ProductArt } from "../components/ProductArt";

export function NotFound() {
  return (
    <div className="container section stack" style={{ alignItems: "center", textAlign: "center", gap: 16 }}>
      <div style={{ width: 180, height: 180 }}><ProductArt kind="mug" /></div>
      <h1 className="h1">Esta página se enfrió</h1>
      <p className="lead">No encontramos lo que buscabas.</p>
      <Link to="/" className="btn btn-primary">Volver al inicio</Link>
    </div>
  );
}

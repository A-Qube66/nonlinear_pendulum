"""Flask entry point for the nonlinear pendulum laboratory."""

from __future__ import annotations

from flask import Flask, jsonify, render_template, request

from pendulum_sim import PendulumParameters, simulate


def create_app() -> Flask:
    app = Flask(__name__)
    app.json.ensure_ascii = False

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.post("/api/simulate")
    def run_simulation():
        try:
            body = request.get_json(silent=True) or {}
            params = PendulumParameters(
                initial_angle_deg=float(body.get("angle", 28.0)),
                length=float(body.get("length", 1.65)),
                gravity=float(body.get("gravity", 9.81)),
                damping_enabled=bool(body.get("damping", False)),
            )
            return jsonify({"ok": True, "parameters": body, "result": simulate(params).to_dict()})
        except (TypeError, ValueError, RuntimeError) as exc:
            return jsonify({"ok": False, "error": str(exc)}), 400

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "solver": "scipy.solve_ivp", "model": "nonlinear"})

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)


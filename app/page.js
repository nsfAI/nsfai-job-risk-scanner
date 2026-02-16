"use client";

import { useState } from "react";

export default function Home() {
  const [jobTitle, setJobTitle] = useState("");
  const [industry, setIndustry] = useState("Tech");
  const [seniority, setSeniority] = useState("Senior / Lead");
  const [jobDescription, setJobDescription] = useState("");
  const [tasks, setTasks] = useState([]);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const taskOptions = [
    "Writing emails, documentation, or reports",
    "Summarizing information / research",
    "Data entry / form processing",
    "Spreadsheet reporting / dashboards",
    "Basic analysis (KPIs, trends) with structured data",
    "Customer support / answering FAQs",
    "Scheduling / coordination / operations admin",
    "Designing workflows / SOPs / process improvement",
    "Negotiation / persuasion / sales conversations",
    "Leading meetings / stakeholder management",
    "Hands-on physical work (field, equipment, lab)",
    "Caregiving / high-empathy human interaction",
    "High-stakes decisions / sign-off / liability responsibility",
    "Creative strategy / brand / ambiguous problem solving",
    "Building software / automation / scripting"
  ];

  const toggleTask = (task) => {
    if (tasks.includes(task)) {
      setTasks(tasks.filter((t) => t !== task));
    } else {
      if (tasks.length < 8) {
        setTasks([...tasks, task]);
      }
    }
  };

  const handleSubmit = async () => {
    setError("");
    setResult("");

    if (!jobDescription.trim()) {
      setError("Job description is required.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          industry,
          seniority,
          description: jobDescription, // IMPORTANT FIX
          tasks
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        setResult(data.result);
      }
    } catch (err) {
      setError("Network error. Try again.");
    }

    setLoading(false);
  };

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: "20px" }}>
      <h1 style={{ fontSize: "40px", fontWeight: "bold" }}>
        NSFAI — Not Safe From AI
      </h1>

      <div style={{ marginTop: 30 }}>
        <input
          placeholder="Job title (optional)"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 15 }}
        />

        <div style={{ display: "flex", gap: 20, marginBottom: 15 }}>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            style={{ flex: 1, padding: 10 }}
          >
            <option>Tech</option>
            <option>Finance</option>
            <option>Healthcare</option>
            <option>Legal</option>
            <option>Education</option>
            <option>Other</option>
          </select>

          <select
            value={seniority}
            onChange={(e) => setSeniority(e.target.value)}
            style={{ flex: 1, padding: 10 }}
          >
            <option>Entry</option>
            <option>Mid</option>
            <option>Senior / Lead</option>
            <option>Executive</option>
          </select>
        </div>

        <textarea
          placeholder="Paste job description (required)"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={6}
          style={{ width: "100%", padding: 12 }}
        />
      </div>

      <h2 style={{ marginTop: 40 }}>Tasks (pick up to 8)</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 20
        }}
      >
        {taskOptions.map((task) => (
          <label
            key={task}
            style={{
              border: "1px solid #ddd",
              padding: 10,
              borderRadius: 8
            }}
          >
            <input
              type="checkbox"
              checked={tasks.includes(task)}
              onChange={() => toggleTask(task)}
              style={{ marginRight: 8 }}
            />
            {task}
          </label>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          marginTop: 30,
          padding: "12px 24px",
          backgroundColor: "black",
          color: "white",
          border: "none",
          borderRadius: 6,
          cursor: "pointer"
        }}
      >
        {loading ? "Generating..." : "Generate NSFAI Report"}
      </button>

      {error && (
        <div style={{ marginTop: 20, color: "red" }}>{error}</div>
      )}

      {result && (
        <div style={{ marginTop: 30, whiteSpace: "pre-wrap" }}>
          {result}
        </div>
      )}
    </main>
  );
}

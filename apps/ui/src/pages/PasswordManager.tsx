import React, { useState, useEffect } from "react";
import {
  Upload,
  Download,
  Search,
  Eye,
  Camera,
  Link,
  Star,
} from "lucide-react";

interface Credential {
  id: string;
  login: string;
  password: string;
  url: string;
  category: string;
  importance: number;
  status: "pending" | "processed" | "verified" | "changed" | "archived";
  changePasswordUrl?: string;
  screenshot?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export default function PasswordManager() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [filteredCredentials, setFilteredCredentials] = useState<Credential[]>(
    []
  );
  const [categories, setCategories] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedImportance, setSelectedImportance] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedCredentials, setSelectedCredentials] = useState<string[]>([]);

  // Fetch credentials
  const fetchCredentials = async () => {
    try {
      const response = await fetch("/api/password-manager/credentials");
      const data = await response.json();
      if (data.success) {
        setCredentials(data.credentials);
        setFilteredCredentials(data.credentials);
        setCategories(data.categories);
        setStatuses(data.statuses);
      }
    } catch (error) {
      console.error("Failed to fetch credentials:", error);
    }
  };

  // Upload CSV
  const handleCsvUpload = async () => {
    if (!csvContent.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/password-manager/upload-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchCredentials();
        setCsvContent("");
        alert(`Successfully imported ${data.result.imported} credentials!`);
      } else {
        alert(`Upload failed: ${data.message}`);
      }
    } catch {
      alert("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  // Filter credentials
  useEffect(() => {
    let filtered = credentials;

    if (selectedCategory) {
      filtered = filtered.filter((c) => c.category === selectedCategory);
    }

    if (selectedStatus) {
      filtered = filtered.filter((c) => c.status === selectedStatus);
    }

    if (selectedImportance) {
      filtered = filtered.filter(
        (c) => c.importance === parseInt(selectedImportance)
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.login.toLowerCase().includes(term) ||
          c.url.toLowerCase().includes(term) ||
          c.tags.some((tag) => tag.toLowerCase().includes(term))
      );
    }

    setFilteredCredentials(filtered);
  }, [
    credentials,
    selectedCategory,
    selectedStatus,
    selectedImportance,
    searchTerm,
  ]);

  // Capture screenshot
  const captureScreenshot = async (id: string) => {
    try {
      const response = await fetch(
        `/api/password-manager/credentials/${id}/screenshot`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        await fetchCredentials();
        alert("Screenshot captured successfully!");
      }
    } catch {
      alert("Failed to capture screenshot");
    }
  };

  // Find password change URL
  const findChangeUrl = async (id: string) => {
    try {
      const response = await fetch(
        `/api/password-manager/credentials/${id}/find-change-url`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        await fetchCredentials();
        alert("Password change URL search completed!");
      }
    } catch {
      alert("Failed to find password change URL");
    }
  };

  // Update credential
  const updateCredential = async (id: string, updates: Partial<Credential>) => {
    try {
      const response = await fetch(`/api/password-manager/credentials/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await fetchCredentials();
      }
    } catch (error) {
      console.error("Failed to update credential:", error);
    }
  };

  // Bulk status update
  const bulkUpdateStatus = async (status: string) => {
    if (selectedCredentials.length === 0) {
      alert("Please select credentials to update");
      return;
    }

    try {
      const response = await fetch("/api/password-manager/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedCredentials,
          status: status,
        }),
      });

      if (response.ok) {
        await fetchCredentials();
        setSelectedCredentials([]);
        alert(
          `Status updated to '${status}' for ${selectedCredentials.length} credentials`
        );
      }
    } catch {
      alert("Failed to update status");
    }
  };

  // Toggle credential selection
  const toggleCredentialSelection = (id: string) => {
    setSelectedCredentials((prev) =>
      prev.includes(id) ? prev.filter((cId) => cId !== id) : [...prev, id]
    );
  };

  // Select all/none
  const toggleSelectAll = () => {
    setSelectedCredentials((prev) =>
      prev.length === filteredCredentials.length
        ? []
        : filteredCredentials.map((c) => c.id)
    );
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Password Manager</h1>
        <a
          href="/api/password-manager/csv-template"
          className="btn btn-outline btn-sm"
          download
        >
          <Download className="w-4 h-4 mr-2" />
          Download Template
        </a>
      </div>

      {/* CSV Upload Section */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">
            <Upload className="w-5 h-5" />
            Upload CSV File
          </h2>
          <textarea
            className="textarea textarea-bordered w-full h-32"
            placeholder="Paste CSV content here... (login,password,url,category,importance,tags)"
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
          />
          <div className="card-actions justify-end">
            <button
              className={`btn btn-primary ${loading ? "loading" : ""}`}
              onClick={handleCsvUpload}
              disabled={!csvContent.trim() || loading}
            >
              Upload CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="form-control">
          <div className="input-group">
            <span>
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search credentials..."
              className="input input-bordered"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <select
          className="select select-bordered"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          className="select select-bordered"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select>

        <select
          className="select select-bordered"
          value={selectedImportance}
          onChange={(e) => setSelectedImportance(e.target.value)}
        >
          <option value="">All Importance</option>
          {[1, 2, 3, 4, 5].map((level) => (
            <option key={level} value={level}>
              Importance {level}
            </option>
          ))}
        </select>

        <div className="badge badge-secondary">
          {filteredCredentials.length} / {credentials.length} credentials
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedCredentials.length > 0 && (
        <div className="bg-base-200 p-4 rounded-lg">
          <div className="flex items-center gap-4">
            <span className="font-semibold">
              {selectedCredentials.length} selected
            </span>
            <div className="flex gap-2">
              <button
                className="btn btn-sm btn-success"
                onClick={() => bulkUpdateStatus("verified")}
              >
                Mark Verified
              </button>
              <button
                className="btn btn-sm btn-warning"
                onClick={() => bulkUpdateStatus("processed")}
              >
                Mark Processed
              </button>
              <button
                className="btn btn-sm btn-info"
                onClick={() => bulkUpdateStatus("changed")}
              >
                Mark Changed
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => bulkUpdateStatus("archived")}
              >
                Archive
              </button>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => setSelectedCredentials([])}
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials Table */}
      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={
                    selectedCredentials.length === filteredCredentials.length &&
                    filteredCredentials.length > 0
                  }
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Login</th>
              <th>URL</th>
              <th>Category</th>
              <th>Status</th>
              <th>Importance</th>
              <th>Screenshot</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCredentials.map((credential) => (
              <tr key={credential.id}>
                <td>
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={selectedCredentials.includes(credential.id)}
                    onChange={() => toggleCredentialSelection(credential.id)}
                  />
                </td>
                <td>
                  <div className="font-medium">{credential.login}</div>
                  <div className="text-sm opacity-50">
                    {credential.tags.map((tag) => (
                      <span
                        key={tag}
                        className="badge badge-xs badge-ghost mr-1"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <a
                    href={credential.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link link-primary"
                  >
                    {credential.url.replace(/^https?:\/\//, "")}
                  </a>
                  {credential.changePasswordUrl && (
                    <div className="text-sm">
                      <a
                        href={credential.changePasswordUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link link-secondary text-xs"
                      >
                        Change Password
                      </a>
                    </div>
                  )}
                </td>
                <td>
                  <select
                    className="select select-xs"
                    value={credential.category}
                    onChange={(e) =>
                      updateCredential(credential.id, {
                        category: e.target.value,
                      })
                    }
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="select select-xs"
                    value={credential.status}
                    onChange={(e) =>
                      updateCredential(credential.id, {
                        status: e.target.value as
                          | "pending"
                          | "processed"
                          | "verified"
                          | "changed"
                          | "archived",
                      })
                    }
                  >
                    {[
                      "pending",
                      "processed",
                      "verified",
                      "changed",
                      "archived",
                    ].map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <Star
                        key={level}
                        className={`w-4 h-4 cursor-pointer ${
                          level <= credential.importance
                            ? "text-yellow-400 fill-current"
                            : "text-gray-300"
                        }`}
                        onClick={() =>
                          updateCredential(credential.id, { importance: level })
                        }
                      />
                    ))}
                  </div>
                </td>
                <td>
                  {credential.screenshot ? (
                    <img
                      src={credential.screenshot}
                      alt="Screenshot"
                      className="w-16 h-12 object-cover rounded cursor-pointer"
                      onClick={() =>
                        window.open(credential.screenshot, "_blank")
                      }
                    />
                  ) : (
                    <span className="text-gray-400 text-sm">No screenshot</span>
                  )}
                </td>
                <td>
                  <div className="flex gap-1">
                    <button
                      className="btn btn-xs btn-outline"
                      onClick={() =>
                        navigator.clipboard.writeText(credential.password)
                      }
                      title="Copy Password"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                    <button
                      className="btn btn-xs btn-outline"
                      onClick={() => captureScreenshot(credential.id)}
                      title="Capture Screenshot"
                    >
                      <Camera className="w-3 h-3" />
                    </button>
                    <button
                      className="btn btn-xs btn-outline"
                      onClick={() => findChangeUrl(credential.id)}
                      title="Find Change URL"
                    >
                      <Link className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredCredentials.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            No credentials found. Upload a CSV file to get started.
          </p>
        </div>
      )}
    </div>
  );
}

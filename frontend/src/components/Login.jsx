import React, { useState, useEffect } from 'react';
import { getMembers } from '../services/api';
import { useAuth } from '../context/AuthContext';
import '../styles/Login.css';

export function Login() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const { login } = useAuth();

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await getMembers();
      setMembers(res.data);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBatch = selectedBatch === 'all' || member.batch.toString() === selectedBatch;
    return matchesSearch && matchesBatch;
  });

  const handleLogin = (member) => {
    login(member);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>🏢 Office Seat Booking System</h1>
          <p>Select your account to continue</p>
        </div>

        <div className="search-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="batch-filter">
            <label>Filter by Batch:</label>
            <select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
              <option value="all">All Batches</option>
              <option value="1">Batch 1</option>
              <option value="2">Batch 2</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading members...</div>
        ) : filteredMembers.length > 0 ? (
          <div className="members-grid">
            {filteredMembers.map(member => (
              <div
                key={member.id}
                className="member-card"
                onClick={() => handleLogin(member)}
              >
                <div className="member-avatar">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="member-details">
                  <h3>{member.name}</h3>
                  <p className="batch-badge">Batch {member.batch} - Squad {member.squad}</p>
                  <p className="email">{member.email}</p>
                </div>
                <button className="login-btn">Login →</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-results">No members found matching your search</div>
        )}
      </div>
    </div>
  );
}

// api/logsApi.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config';



const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const debugCheckStorage = async () => {
  const user = await AsyncStorage.getItem('user');
  const sessionId = await AsyncStorage.getItem('sessionId');
  console.log("🧾 user in logout check:", user);
  console.log("📎 sessionId in logout check:", sessionId);
};


// Get Auth Headers Safely
export const getAuthHeaders = async () => {
  try {
    const userData = await AsyncStorage.getItem('user');
    if (!userData) {
      console.warn("⚠️ No user data found in AsyncStorage");
      return null;
    }

    const user = JSON.parse(userData);
    if (!user?.token) {
      console.warn("⚠️ No token found in user data");
      return null;
    }

    return {
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    };
  } catch (error) {
    console.error("🚫 Error parsing user data for auth headers:", error);
    return null;
  }
};



// Fetch Logs
export const fetchLogs = async () => {
  const headers = await getAuthHeaders();
  if (!headers) {
    console.warn('⚠️ Skipping fetchLogs, no auth headers');
    return [];
  }

  try {
    const res = await axios.get(`${BASE_URL}/api/auth/logs/`, headers);
    return res.data;
  } catch (err) {
    console.error('❌ Error fetching logs:', err);
    return [];
  }
};

// Log Page Visit
export const logPageVisit = async (page_name, filters = {}) => {
  const headers = await getAuthHeaders();
  if (!headers) {
    console.warn('⚠️ Skipping logPageVisit, no auth headers');
    return;
  }

  try {
    await axios.post(`${BASE_URL}/api/auth/logpage/`, { page_name, filters }, headers);
  } catch (err) {
    console.warn('❌ Logging failed:', err);
  }
};

// Fetch Top Pages
export const fetchTopPages = async () => {
  const headers = await getAuthHeaders();
  if (!headers) {
    console.warn('⚠️ Skipping fetchTopPages, no auth headers');
    return [];
  }

  try {
    const res = await axios.get(`${BASE_URL}/api/auth/logs/top/`, headers);
    return res.data;
  } catch (err) {
    console.error('❌ Error fetching top pages:', err);
    return [];
  }
};

// Delete a Log by ID
export const deleteLogById = async (logId) => {
  const headers = await getAuthHeaders();
  if (!headers) {
    console.warn('⚠️ Skipping deleteLogById, no auth headers');
    return;
  }

  try {
    await axios.delete(`${BASE_URL}/api/auth/logs/delete/${logId}/`, headers);
  } catch (err) {
    console.error(`❌ Failed to delete log ${logId}:`, err);
  }
};

// Record a Visit (Wrapper)
export const recordVisit = async (page, filters = {}) => {
  try {
    const headers = await getAuthHeaders();
    if (!headers) {
      console.warn("⚠️ Skipping logPageVisit, no auth headers");
      return;
    }

    await axios.post(`${BASE_URL}/api/auth/logpage/`, { page_name: page, filters }, headers);
  } catch (err) {
    console.warn("Logging failed:", err);
  }
};



// api/LogsApi.js
export const logoutUser = async (token, sessionId) => {
  console.log("🚪 Logging out...");

  if (!token || !sessionId) {
    // console.warn("⚠️ Missing token or session ID");
    return false;
  }

  try {
    const response = await fetch(`${BASE_URL}/api/auth/logout/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ session_id: sessionId }),
    });

    const result = await response.json();
    // console.log("🧾 Logout API response:", result);

    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('sessionId');

    // console.log("🔚 Logout success? true");
    return true;
  } catch (error) {
    console.error("❌ Logout error:", error);
    return false;
  }
};



// Delete a visit from a log
export const deleteVisitFromLog = async (logId, visitId) => {
  const headers = await getAuthHeaders();
  if (!headers) {
    console.warn('⚠️ No auth headers for visit deletion');
    return false;
  }

  try {
    await axios.delete(`${BASE_URL}/api/auth/logs/${logId}/visit/${visitId}/`, headers);
    return true;
  } catch (err) {
    console.error(`❌ Error deleting visit ${visitId} from log ${logId}:`, err);
    return false;
  }
};

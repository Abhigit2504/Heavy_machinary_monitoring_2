// utils/logoutUser.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config';

export const logoutUser = async () => {
  try {
    // Wait for AsyncStorage data first
    const userData = await AsyncStorage.getItem('user');
    const sessionId = await AsyncStorage.getItem('sessionId');
    const token = userData ? JSON.parse(userData)?.token : null;

    console.log("🧪 Before logout - user:", userData);
    console.log("🧪 Before logout - sessionId:", sessionId);

    if (token && sessionId) {
      const response = await fetch(`${BASE_URL}/api/auth/logout/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (response.ok) {
        console.log("✅ Logout API success");
      } else {
        console.warn("❗ Logout API returned:", response.status);
      }
    } else {
      console.warn("⚠️ Missing token or session ID during logout.");
    }
  } catch (err) {
    console.error("❌ Error during logout:", err);
  }

  // ✅ Clear ONLY after the fetch
  await AsyncStorage.clear();
  console.log("🧹 Cleared AsyncStorage");
};

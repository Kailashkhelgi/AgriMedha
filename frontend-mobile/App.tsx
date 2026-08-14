import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { setNavigationCallback } from './src/api/client';
import { registerForPushNotifications, setupNotificationHandlers } from './src/notifications';

import AuthScreen from './src/screens/AuthScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SoilProfileScreen from './src/screens/SoilProfileScreen';
import CropAdvisoryScreen from './src/screens/CropAdvisoryScreen';
import FertilizerScreen from './src/screens/FertilizerScreen';
import WeatherScreen from './src/screens/WeatherScreen';
import ImageAnalysisScreen from './src/screens/ImageAnalysisScreen';
import MarketPriceScreen from './src/screens/MarketPriceScreen';
import FeedbackScreen from './src/screens/FeedbackScreen';
import DashboardScreen from './src/screens/DashboardScreen';

type Screen =
  | 'auth'
  | 'home'
  | 'profile'
  | 'soil-profile'
  | 'crop-advisory'
  | 'fertilizer'
  | 'weather'
  | 'image-analysis'
  | 'market-price'
  | 'feedback'
  | 'dashboard';

// Demo props — in a real app these come from user state / route params
const DEMO_PLOT_ID = 'plot-1';
const DEMO_CROP_ID = 'crop-1';
const DEMO_LAT = 30.7333;
const DEMO_LON = 76.7794;
const DEMO_SESSION_ID = 'session-1';
const DEMO_ROLE: 'officer' | 'admin' = 'officer';

export default function App() {
  const [screen, setScreen] = useState<Screen>('auth');
  const [authenticated, setAuthenticated] = useState(false);
  const notificationsSetUp = useRef(false);

  // Register navigation callback so the API client can redirect on 401
  setNavigationCallback(() => {
    setAuthenticated(false);
    setScreen('auth');
  });

  // Set up push notifications after authentication
  useEffect(() => {
    if (!authenticated || notificationsSetUp.current) return;
    notificationsSetUp.current = true;

    registerForPushNotifications().then((token) => {
      if (token) {
        // Token can be sent to the backend to store against the farmer's FCM token field
        console.log('Expo push token:', token);
      }
    });

    setupNotificationHandlers(
      (data) => {
        Alert.alert('Weather Alert', 'A weather alert has been issued for your location. Check the Weather screen for details.');
        console.log('Weather alert data:', data);
      },
      (data) => {
        Alert.alert('Frost Alert', 'Frost risk detected for your location. Take protective action for your crops.');
        console.log('Frost alert data:', data);
      },
    );
  }, [authenticated]);

  function navigate(target: string) {
    setScreen(target as Screen);
  }

  if (!authenticated || screen === 'auth') {
    return (
      <SafeAreaView style={styles.root}>
        <AuthScreen onAuthenticated={() => { setAuthenticated(true); setScreen('home'); }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      {screen === 'profile' && <ProfileScreen onNavigate={navigate} />}
      {screen === 'soil-profile' && <SoilProfileScreen onNavigate={navigate} />}
      {screen === 'crop-advisory' && <CropAdvisoryScreen plotId={DEMO_PLOT_ID} onNavigate={navigate} />}
      {screen === 'fertilizer' && <FertilizerScreen plotId={DEMO_PLOT_ID} cropId={DEMO_CROP_ID} onNavigate={navigate} />}
      {screen === 'weather' && <WeatherScreen lat={DEMO_LAT} lon={DEMO_LON} onNavigate={navigate} />}
      {screen === 'image-analysis' && <ImageAnalysisScreen onNavigate={navigate} />}
      {screen === 'market-price' && <MarketPriceScreen onNavigate={navigate} />}
      {screen === 'feedback' && (
        <FeedbackScreen sessionId={DEMO_SESSION_ID} onDismiss={() => navigate('home')} />
      )}
      {screen === 'dashboard' && <DashboardScreen role={DEMO_ROLE} onNavigate={navigate} />}
      {screen === 'home' && (
        <HomeMenu onNavigate={navigate} />
      )}
    </SafeAreaView>
  );
}

// Minimal home menu
function HomeMenu({ onNavigate }: { onNavigate: (s: string) => void }) {
  const items: { label: string; screen: string }[] = [
    { label: '👤 My Profile', screen: 'profile' },
    { label: '🌱 Soil Profile', screen: 'soil-profile' },
    { label: '🌾 Crop Advisory', screen: 'crop-advisory' },
    { label: '🧪 Fertilizer Guidance', screen: 'fertilizer' },
    { label: '🌤 Weather Alerts', screen: 'weather' },
    { label: '📷 Image Analysis', screen: 'image-analysis' },
    { label: '💰 Market Prices', screen: 'market-price' },
    { label: '⭐ Feedback', screen: 'feedback' },
    { label: '📊 Dashboard', screen: 'dashboard' },
  ];

  return (
    <ScrollView contentContainerStyle={menuStyles.container}>
      <Text style={menuStyles.title}>Smart Crop Advisory</Text>
      {items.map((item) => (
        <TouchableOpacity key={item.screen} style={menuStyles.item} onPress={() => onNavigate(item.screen)}>
          <Text style={menuStyles.itemText}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
});

const menuStyles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 28, textAlign: 'center' },
  item: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    marginBottom: 10,
  },
  itemText: { fontSize: 16, color: '#333' },
});

import { Tabs } from 'expo-router';
import { Map, Users, AlertCircle, Calendar, Menu } from 'lucide-react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6200ea',
        tabBarInactiveTintColor: '#757575',
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          tabBarLabel: 'Carte',
          tabBarIcon: ({ color, size }) => <Map color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          tabBarLabel: 'Communauté',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          tabBarLabel: 'Signalements',
          tabBarIcon: ({ color, size }) => <AlertCircle color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          tabBarLabel: 'Événements',
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          tabBarLabel: 'Menu',
          tabBarIcon: ({ color, size }) => <Menu color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="help"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
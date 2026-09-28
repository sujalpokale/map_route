import React from 'react';
import { Tabs } from 'expo-router';
import { LayoutDashboard, MapPin, Compass, Bot, User, Truck } from 'lucide-react-native';
import { THEME } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#202124',
          borderTopColor: 'rgba(255, 255, 255, 0.12)',
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#8AB4F8',
        tabBarInactiveTintColor: '#9AA0A6',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Command',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="routes"
        options={{
          title: 'Optimize',
          tabBarIcon: ({ color, size }) => <Compass size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trips',
          tabBarIcon: ({ color, size }) => <Truck size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: 'AI Copilot',
          tabBarIcon: ({ color, size }) => <Bot size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}

import React from 'react';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#000' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Forms',
          headerTitle: 'FieldTally',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
        }}
      />
    </Tabs>
  );
}

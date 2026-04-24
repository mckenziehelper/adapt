import { Tabs } from 'expo-router'
import { View } from 'react-native'
import Svg, { Circle, Path, Rect, Line } from 'react-native-svg'
import { Colors } from '../../constants/theme'

function IconHome({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M4 19V11.5L12 4l8 7.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M9 20v-6h6v6" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  )
}

function IconProgress({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M3 20h18" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M5 20V14M9 20V9M13 20V12M17 20V5M21 20V10" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  )
}

function IconProfile({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.5} stroke={color} strokeWidth={1.6} />
      <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  )
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 0.5,
          borderTopColor: Colors.line,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.faint,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3, marginBottom: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <IconHome color={color} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color }) => <IconProgress color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconProfile color={color} />,
        }}
      />
    </Tabs>
  )
}

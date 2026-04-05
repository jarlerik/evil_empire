import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import {
  colors,
  Text,
  Box,
  Card,
  StatCard,
  StatRow,
  Badge,
  StatusIndicator,
  ActivityFeed,
  DataTable,
  TerminalBlock,
  SidebarNav,
  Header,
  SystemStatus,
  Button,
  Input,
} from '@evil-empire/ui';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      <Text variant="heading" style={sectionStyles.title}>{title}</Text>
      {children}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: { marginBottom: 32 },
  title: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#2A2A2A', paddingBottom: 8 },
});

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>{children}</View>;
}

export function App() {
  const [activeNav, setActiveNav] = useState('command');
  const [inputValue, setInputValue] = useState('');

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
          {/* Title */}
          <Text variant="display" color={colors.primary}>EVIL UI</Text>
          <Text variant="body-sm" color={colors['text-secondary']} style={{ marginBottom: 24 }}>
            Component Showcase — Mobile
          </Text>

          {/* Header */}
          <Section title="Header">
            <Header
              breadcrumbs={['TACTICAL COMMAND', 'OVERVIEW']}
              timestamp="01/01/2025 20:00 UTC"
            />
          </Section>

          {/* Typography */}
          <Section title="Typography">
            <Text variant="display">Display 32px</Text>
            <Text variant="heading-lg">Heading Large 24px</Text>
            <Text variant="heading">Heading 20px</Text>
            <Text variant="heading-sm">Heading Small 16px</Text>
            <Text variant="body">Body 14px</Text>
            <Text variant="body-sm" color={colors['text-secondary']}>Body Small 12px</Text>
            <Text variant="caption" color={colors['text-muted']}>Caption 10px</Text>
            <Text variant="mono">Mono 13px</Text>
          </Section>

          {/* Buttons */}
          <Section title="Button">
            <Row>
              <Button title="Primary" variant="primary" onPress={() => {}} />
              <Button title="Ghost" variant="ghost" onPress={() => {}} />
              <Button title="Outline" variant="outline" onPress={() => {}} />
            </Row>
            <Row>
              <Button title="Destructive" variant="destructive" onPress={() => {}} />
              <Button title="Loading" variant="primary" loading onPress={() => {}} />
              <Button title="Disabled" variant="primary" disabled onPress={() => {}} />
            </Row>
          </Section>

          {/* Input */}
          <Section title="Input">
            <Input
              label="AGENT CODENAME"
              placeholder="Enter codename..."
              value={inputValue}
              onChangeText={setInputValue}
            />
            <View style={{ height: 12 }} />
            <Input label="FILLED" placeholder="Filled..." variant="filled" />
            <View style={{ height: 12 }} />
            <Input label="ERROR" value="gh0st_INVALID" error="Access denied" />
          </Section>

          {/* Badges */}
          <Section title="Badge">
            <Row>
              <Badge label="Default" variant="default" />
              <Badge label="gh0st_Fire" variant="primary" />
              <Badge label="Online" variant="success" />
              <Badge label="Compromised" variant="destructive" />
            </Row>
          </Section>

          {/* Status Indicators */}
          <Section title="StatusIndicator">
            <Row>
              <StatusIndicator status="online" label="Online" />
              <StatusIndicator status="offline" label="Offline" />
              <StatusIndicator status="danger" label="Danger" />
              <StatusIndicator status="warning" label="Warning" />
            </Row>
          </Section>

          {/* Stat Cards */}
          <Section title="StatCard">
            <StatCard value={190} label="Active" />
            <View style={{ height: 8 }} />
            <StatCard value={990} label="Shadownet Tracking" trend="+12%" />
            <View style={{ height: 8 }} />
            <StatCard value={290} label="Field" />
          </Section>

          {/* Stat Rows */}
          <Section title="StatRow">
            <Card variant="bordered">
              <Text variant="heading-sm" style={{ marginBottom: 12 }}>MISSION INFORMATION</Text>
              <StatRow label="Successful Missions" value="—" variant="success" />
              <StatRow label="High Risk Mission" value="190" variant="danger" />
              <StatRow label="Active Operations" value="42" />
            </Card>
          </Section>

          {/* Activity Feed */}
          <Section title="ActivityFeed">
            <Card variant="bordered">
              <Text variant="heading-sm" style={{ marginBottom: 12 }}>ACTIVITY LOG</Text>
              <ActivityFeed
                items={[
                  { id: '1', timestamp: '09:28', message: 'Agent gh0st_Fire completed mission in Berlin', highlightedText: 'gh0st_Fire' },
                  { id: '2', timestamp: '09:12', message: 'Agent c0ugh_V1b extracted target in Cairo', highlightedText: 'c0ugh_V1b' },
                  { id: '3', timestamp: '22:45', message: 'Agent onion_Shade lost comms in Havana', highlightedText: 'onion_Shade' },
                ]}
              />
            </Card>
          </Section>

          {/* Terminal Block */}
          <Section title="TerminalBlock">
            <TerminalBlock
              lines={[
                { id: '1', text: '> [AGT:gh0stfir3] ::: INT >>', color: '#9BA1A6' },
                { id: '2', text: '*** loading secure channel', color: '#666666' },
                { id: '3', text: '~ CHK2 | 1231.008...xk3 >', color: '#c65d24' },
                { id: '4', text: '> KEY LOCKED', color: '#22C55E' },
                { id: '5', text: '> MSG >>> "... mission clearance initiated..."', color: '#FFFFFF' },
              ]}
            />
          </Section>

          {/* System Status */}
          <Section title="SystemStatus">
            <SystemStatus
              status="online"
              uptime="72:14:32"
              stats={{ AGENTS: 847, MISSIONS: 23 }}
            />
          </Section>

          {/* Data Table */}
          <Section title="DataTable">
            <Card variant="bordered">
              <DataTable
                columns={[
                  { key: 'id', title: 'ID', width: 80 },
                  { key: 'codename', title: 'CODENAME' },
                  { key: 'status', title: 'STATUS', width: 80 },
                ]}
                data={[
                  { id: 'G-078W', codename: 'VENGEANCE SPIRIT', status: 'online' },
                  { id: 'G-079X', codename: 'OBSIDIAN SENTINEL', status: 'online' },
                  { id: 'G-080Y', codename: 'GHOST1 FURY', status: 'offline' },
                ]}
                keyExtractor={(item: { id: string }) => item.id}
              />
            </Card>
          </Section>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
});

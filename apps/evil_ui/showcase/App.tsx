import { View, ScrollView, StyleSheet } from 'react-native';
import {
  // Theme
  colors,
  // Primitives
  Box,
  Text,
  Pressable,
  Icon,
  // Components
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
} from '../src/index';
import { useState } from 'react';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      <Text variant="heading-lg" style={sectionStyles.title}>{title}</Text>
      <View style={sectionStyles.content}>{children}</View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: { marginBottom: 40 },
  title: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8 },
  content: { gap: 12 },
});

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>{children}</View>;
}

export function App() {
  const [activeNav, setActiveNav] = useState('command');
  const [inputValue, setInputValue] = useState('');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={appStyles.container}>
        {/* Page Header */}
        <View style={appStyles.pageHeader}>
          <Text variant="display" color={colors.primary}>EVIL UI</Text>
          <Text variant="body" color={colors['text-secondary']}>Tactical Component Library — Showcase</Text>
        </View>

        {/* Header */}
        <Section title="Header">
          <Header
            breadcrumbs={['TACTICAL COMMAND', 'OVERVIEW']}
            timestamp="01/01/2025 20:00 UTC"
          />
        </Section>

        {/* Typography */}
        <Section title="Typography">
          <Text variant="display">Display — 32px Bold</Text>
          <Text variant="heading-lg">Heading Large — 24px Bold</Text>
          <Text variant="heading">Heading — 20px Semibold</Text>
          <Text variant="heading-sm">Heading Small — 16px Semibold</Text>
          <Text variant="body">Body — 14px Regular</Text>
          <Text variant="body-sm" color={colors['text-secondary']}>Body Small — 12px Secondary</Text>
          <Text variant="caption" color={colors['text-muted']}>Caption — 10px Muted</Text>
          <Text variant="mono">Mono — 13px Monospace</Text>
        </Section>

        {/* Box Primitives */}
        <Section title="Box (Primitives)">
          <Row>
            <Box variant="card" style={{ padding: 16, width: 200 }}>
              <Text variant="body">Card variant</Text>
            </Box>
            <Box variant="elevated" style={{ padding: 16, width: 200 }}>
              <Text variant="body">Elevated variant</Text>
            </Box>
          </Row>
        </Section>

        {/* Buttons */}
        <Section title="Button">
          <Row>
            <Button title="Primary" variant="primary" onPress={() => {}} />
            <Button title="Ghost" variant="ghost" onPress={() => {}} />
            <Button title="Outline" variant="outline" onPress={() => {}} />
            <Button title="Destructive" variant="destructive" onPress={() => {}} />
          </Row>
          <Row>
            <Button title="Small" variant="primary" size="sm" onPress={() => {}} />
            <Button title="Medium" variant="primary" size="md" onPress={() => {}} />
            <Button title="Large" variant="primary" size="lg" onPress={() => {}} />
          </Row>
          <Row>
            <Button title="Loading..." variant="primary" loading onPress={() => {}} />
            <Button title="Disabled" variant="primary" disabled onPress={() => {}} />
          </Row>
        </Section>

        {/* Input */}
        <Section title="Input">
          <View style={{ maxWidth: 400, gap: 12 }}>
            <Input
              label="AGENT CODENAME"
              placeholder="Enter codename..."
              value={inputValue}
              onChangeText={setInputValue}
            />
            <Input
              label="FILLED VARIANT"
              placeholder="Filled input..."
              variant="filled"
            />
            <Input
              label="WITH ERROR"
              placeholder="Invalid input..."
              error="Access denied — invalid credentials"
              value="gh0st_INVALID"
            />
          </View>
        </Section>

        {/* Badges */}
        <Section title="Badge">
          <Row>
            <Badge label="Default" variant="default" />
            <Badge label="gh0st_Fire" variant="primary" />
            <Badge label="Online" variant="success" />
            <Badge label="Compromised" variant="destructive" />
          </Row>
          <Row>
            <Badge label="Small" variant="primary" size="sm" />
            <Badge label="Medium" variant="primary" size="md" />
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

        {/* Cards */}
        <Section title="Card">
          <Row>
            <Card variant="bordered" style={{ width: 250 }}>
              <Text variant="heading-sm">Bordered Card</Text>
              <Text variant="body-sm" color={colors['text-secondary']}>Default card with border</Text>
            </Card>
            <Card variant="default" style={{ width: 250 }}>
              <Text variant="heading-sm">Default Card</Text>
              <Text variant="body-sm" color={colors['text-secondary']}>No border variant</Text>
            </Card>
            <Card variant="ghost" style={{ width: 250 }}>
              <Text variant="heading-sm">Ghost Card</Text>
              <Text variant="body-sm" color={colors['text-secondary']}>Transparent background</Text>
            </Card>
          </Row>
        </Section>

        {/* Stat Cards */}
        <Section title="StatCard">
          <Row>
            <View style={{ width: 200 }}>
              <StatCard value={190} label="Active" />
            </View>
            <View style={{ width: 200 }}>
              <StatCard value={990} label="Shadownet Tracking" trend="+12%" />
            </View>
            <View style={{ width: 200 }}>
              <StatCard value={290} label="Field" />
            </View>
          </Row>
        </Section>

        {/* Stat Rows */}
        <Section title="StatRow">
          <Card variant="bordered" style={{ maxWidth: 400 }}>
            <Text variant="heading-sm" style={{ marginBottom: 12 }}>MISSION INFORMATION</Text>
            <StatRow label="Successful Missions" value="—" variant="success" />
            <StatRow label="High Risk Mission" value="190" variant="danger" />
            <StatRow label="Active Operations" value="42" variant="default" />
          </Card>
        </Section>

        {/* Activity Feed */}
        <Section title="ActivityFeed">
          <Card variant="bordered" style={{ maxWidth: 500 }}>
            <Text variant="heading-sm" style={{ marginBottom: 12 }}>ACTIVITY LOG</Text>
            <ActivityFeed
              items={[
                { id: '1', timestamp: '25/06/2025 09:28', message: 'Agent gh0st_Fire completed mission in Berlin with agent tar0_High', highlightedText: 'gh0st_Fire' },
                { id: '2', timestamp: '25/06/2025 09:12', message: 'Agent c0ugh_V1b extracted high-value target in Cairo', highlightedText: 'c0ugh_V1b' },
                { id: '3', timestamp: '25/06/2025 22:45', message: 'Agent onion_Shade lost communication in Havana', highlightedText: 'onion_Shade' },
                { id: '4', timestamp: '25/06/2025 21:33', message: 'Agent phant0m_R4ven initiated surveillance in Tokyo', highlightedText: 'phant0m_R4ven' },
              ]}
            />
          </Card>
        </Section>

        {/* Data Table */}
        <Section title="DataTable">
          <Card variant="bordered">
            <Text variant="heading-sm" style={{ marginBottom: 12 }}>AGENT ROSTER</Text>
            <DataTable
              columns={[
                { key: 'id', title: 'ID', width: 100 },
                { key: 'codename', title: 'CODENAME' },
                { key: 'status', title: 'STATUS', width: 100, render: (item: { status: string }) => (
                  <StatusIndicator status={item.status as 'online' | 'offline' | 'danger'} label={item.status} />
                )},
              ]}
              data={[
                { id: 'G-078W', codename: 'VENGEANCE SPIRIT', status: 'online' },
                { id: 'G-079X', codename: 'OBSIDIAN SENTINEL', status: 'online' },
                { id: 'G-080Y', codename: 'GHOST1 FURY', status: 'offline' },
                { id: 'G-081Z', codename: 'CURSED REVENANT', status: 'danger' },
              ]}
              keyExtractor={(item: { id: string }) => item.id}
            />
          </Card>
        </Section>

        {/* Terminal Block */}
        <Section title="TerminalBlock">
          <Card variant="bordered" style={{ maxWidth: 500 }}>
            <Text variant="heading-sm" style={{ marginBottom: 12 }}>ENCRYPTED CHAT ACTIVITY</Text>
            <TerminalBlock
              lines={[
                { id: '1', text: '> [AGT:gh0stfir3] ::: INT >>', color: colors['text-secondary'] },
                { id: '2', text: '*** loading secure channel', color: colors['text-muted'] },
                { id: '3', text: '~ CHK2 | 1231.0082464.500...xk3 >', color: colors.primary },
                { id: '4', text: '> KEY LOCKED', color: colors.success },
                { id: '5', text: '> MSG >>> "... mission clearance initiated... exerting delta route clearance ..."', color: colors.text },
              ]}
            />
          </Card>
        </Section>

        {/* System Status */}
        <Section title="SystemStatus">
          <Row>
            <SystemStatus
              status="online"
              uptime="72:14:32"
              stats={{ AGENTS: 847, MISSIONS: 23 }}
            />
            <SystemStatus status="offline" uptime="00:00:00" />
            <SystemStatus status="degraded" uptime="12:30:01" stats={{ ERRORS: 3 }} />
          </Row>
        </Section>

        {/* Sidebar Nav (rendered inline for demo) */}
        <Section title="SidebarNav">
          <View style={{ height: 350 }}>
            <SidebarNav
              items={[
                { key: 'command', label: 'COMMAND CENTER' },
                { key: 'network', label: 'AGENT NETWORK' },
                { key: 'operations', label: 'OPERATIONS' },
                { key: 'intelligence', label: 'INTELLIGENCE' },
                { key: 'systems', label: 'SYSTEMS' },
              ]}
              activeKey={activeNav}
              onSelect={setActiveNav}
              header={
                <View>
                  <Text variant="heading" color={colors.primary}>TACTICAL OPS</Text>
                  <Text variant="caption" color={colors['text-muted']}>v2.1.7 CLASSIFIED</Text>
                </View>
              }
              footer={
                <SystemStatus status="online" uptime="72:14:32" stats={{ AGENTS: 847, MISSIONS: 23 }} />
              }
            />
          </View>
        </Section>
      </View>
    </ScrollView>
  );
}

const appStyles = StyleSheet.create({
  container: {
    padding: 40,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  pageHeader: {
    marginBottom: 48,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 16,
  },
});

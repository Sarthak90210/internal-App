import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme, Card, Button, IconButton, Searchbar, SegmentedButtons } from 'react-native-paper';
import { MessagesService } from '../../services/messages';
import { useAuthStore } from '../../stores/authStore';

export default function ManageContactMessagesScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const unsubscribe = MessagesService.subscribeToMessages((data) => {
      setMessages(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleToggleStatus = (msg) => {
    const newStatus = msg.status === 'unread' ? 'read' : 'unread';
    MessagesService.updateMessageStatus(msg.id, newStatus, user?.name, user?.email)
      .catch(() => Alert.alert('Error', 'Failed to update status'));
  };

  const handleDelete = (msg) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        MessagesService.deleteMessage(msg.id).catch(() => Alert.alert('Error', 'Failed to delete message'));
      }}
    ]);
  };

  const handleReply = (msg) => {
    Linking.openURL(`mailto:${msg.email}?subject=Re: [Team RotorFPV] ${msg.queryType}`);
  };

  const filteredMessages = messages.filter(msg => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = msg.name?.toLowerCase().includes(q) || msg.email?.toLowerCase().includes(q) || msg.message?.toLowerCase().includes(q);
    if (filter === 'all') return matchesSearch;
    return matchesSearch && msg.status === filter;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={{ padding: 16 }}>
        <Searchbar
          placeholder="Search messages..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={{ marginBottom: 16 }}
        />
        <SegmentedButtons
          value={filter}
          onValueChange={setFilter}
          buttons={[
            { value: 'all', label: 'All' },
            { value: 'unread', label: 'Unread' },
            { value: 'read', label: 'Read' }
          ]}
        />
      </View>

      <FlatList
        data={filteredMessages}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 16 }}
        renderItem={({ item }) => (
          <Card style={[styles.card, { backgroundColor: item.status === 'unread' ? theme.colors.primaryContainer : theme.colors.surface }]}>
            <Card.Content>
              <View style={styles.header}>
                <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{item.name}</Text>
                <Text variant="bodySmall">{item.createdAt.toLocaleString()}</Text>
              </View>
              <Text variant="bodyMedium" style={{ color: theme.colors.primary }}>{item.email}</Text>
              
              <View style={styles.tagsRow}>
                {item.phone ? <Text style={styles.tag}>📞 {item.phone}</Text> : null}
                {item.organization ? <Text style={styles.tag}>🏢 {item.organization}</Text> : null}
                {item.queryType ? <Text style={[styles.tag, { backgroundColor: theme.colors.secondaryContainer }]}>{item.queryType}</Text> : null}
              </View>

              <Text style={{ marginTop: 12 }}>{item.message}</Text>
            </Card.Content>
            <Card.Actions>
              <Button onPress={() => handleToggleStatus(item)}>{item.status === 'unread' ? 'Mark Read' : 'Mark Unread'}</Button>
              <Button onPress={() => handleReply(item)}>Reply</Button>
              <IconButton icon="delete" iconColor={theme.colors.error} onPress={() => handleDelete(item)} />
            </Card.Actions>
          </Card>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No messages found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tag: { fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#f0f0f0' }
});

import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, Linking, ScrollView, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Mail, MailOpen, Phone, Building2, Reply, Trash2, Clock, CheckCircle, AlertCircle, MessageSquare } from '../../lib/lucideIcons';
import { MessagesService } from '../../services/messages';
import { 
  AppSearchBar, 
  AppChip, 
  AppCard, 
  AppButton, 
  AppBadge, 
  AppSkeleton, 
  AppEmptyState 
} from '../../components/design-system';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';

export default function ManageContactMessagesScreen() {
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
    MessagesService.updateMessageStatus(msg.id, newStatus)
      .catch(() => Alert.alert('Error', 'Failed to update message read status in cloud storage.'));
  };

  const handleDelete = (msg) => {
    Alert.alert('Delete Inquiry', `Are you sure you want to permanently delete this message from "${msg.name || 'Anonymous'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        MessagesService.deleteMessage(msg.id).catch(() => Alert.alert('Error', 'Failed to delete message.'));
      }}
    ]);
  };

  const handleReply = (msg) => {
    Linking.openURL(`mailto:${msg.email}?subject=Re: [Team RotorFPV] ${msg.queryType || 'Inquiry Response'}`);
  };

  const filteredMessages = messages.filter(msg => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (msg.name?.toLowerCase() || '').includes(q) || 
                          (msg.email?.toLowerCase() || '').includes(q) || 
                          (msg.message?.toLowerCase() || '').includes(q) ||
                          (msg.organization?.toLowerCase() || '').includes(q);
    if (filter === 'all') return matchesSearch;
    return matchesSearch && msg.status === filter;
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerArea}>
        <AppSearchBar
          placeholder="Search inquiries by name, email, or content..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <View style={styles.filterRow}>
          <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            <AppChip 
              label={`All (${messages.length})`}
              selected={filter === 'all'}
              onPress={() => setFilter('all')}
            />
            <AppChip 
              label={`Unread (${messages.filter(m => m.status === 'unread').length})`}
              selected={filter === 'unread'}
              onPress={() => setFilter('unread')}
            />
            <AppChip 
              label={`Read (${messages.filter(m => m.status === 'read').length})`}
              selected={filter === 'read'}
              onPress={() => setFilter('read')}
            />
          </ScrollView>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <AppSkeleton width="100%" height={160} style={{ marginBottom: 16 }} />
          <AppSkeleton width="100%" height={160} style={{ marginBottom: 16 }} />
          <AppSkeleton width="100%" height={160} />
        </View>
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={filteredMessages}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isUnread = item.status === 'unread';
            const formattedDate = item.createdAt && item.createdAt.toLocaleString ? item.createdAt.toLocaleString() : 'Recent';

            return (
              <AppCard 
                variant={isUnread ? "elevated" : "surface"} 
                style={[styles.msgCard, isUnread && styles.unreadCardBorder]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.senderInfo}>
                    <View style={[styles.iconBox, { backgroundColor: isUnread ? '#8B5CF620' : '#A855F715' }]}>
                      {isUnread ? <Mail size={18} color="#8B5CF6" /> : <MailOpen size={18} color="#A855F7" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.senderName}>{item.name || 'Anonymous Inquiry'}</Text>
                      <Text style={styles.senderEmail}>{item.email || 'No email provided'}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <AppBadge variant={isUnread ? "primary" : "secondary"}>
                      {isUnread ? "NEW INQUIRY" : "READ"}
                    </AppBadge>
                    <View style={styles.timeRow}>
                      <Clock size={12} color={appColors.textMuted} style={{ marginRight: 4 }} />
                      <Text style={styles.timeText}>{formattedDate}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.tagsContainer}>
                  {item.queryType ? (
                    <View style={[styles.metaChip, { backgroundColor: '#38BDF815', borderColor: '#38BDF830' }]}>
                      <MessageSquare size={12} color="#38BDF8" style={{ marginRight: 6 }} />
                      <Text style={[styles.metaText, { color: '#38BDF8' }]}>{item.queryType.toUpperCase()}</Text>
                    </View>
                  ) : null}
                  {item.phone ? (
                    <View style={styles.metaChip}>
                      <Phone size={12} color={appColors.textSecondary} style={{ marginRight: 6 }} />
                      <Text style={styles.metaText}>{item.phone}</Text>
                    </View>
                  ) : null}
                  {item.organization ? (
                    <View style={styles.metaChip}>
                      <Building2 size={12} color={appColors.textSecondary} style={{ marginRight: 6 }} />
                      <Text style={styles.metaText}>{item.organization}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.messageBox}>
                  <Text style={styles.messageContent}>{item.message || 'No message content provided.'}</Text>
                </View>

                <View style={styles.actionsRow}>
                  <AppButton
                    variant={isUnread ? "secondary" : "ghost"}
                    size="sm"
                    onPress={() => handleToggleStatus(item)}
                    style={{ marginRight: 8 }}
                    icon={isUnread ? <CheckCircle size={14} color={appColors.textPrimary} /> : <AlertCircle size={14} color={appColors.textSecondary} />}
                  >
                    {isUnread ? "Mark as Read" : "Mark as Unread"}
                  </AppButton>

                  <AppButton
                    variant="primary"
                    size="sm"
                    onPress={() => handleReply(item)}
                    style={{ flex: 1, marginRight: 8 }}
                    icon={<Reply size={14} color={appColors.background} />}
                  >
                    Reply via Email
                  </AppButton>

                  <Pressable 
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item)}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </Pressable>
                </View>
              </AppCard>
            );
          }}
          ListEmptyComponent={
            <AppEmptyState
              title={`No ${filter === 'all' ? '' : filter} inquiries found`}
              description={searchQuery ? "No contact messages matched your search query." : "When prospective sponsors, students, or partners contact the team through the website, messages appear here."}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: appColors.background, 
  },
  headerArea: {
    paddingHorizontal: appSpacing.xl,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: appColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: appColors.border,
  },
  filterRow: {
    marginTop: 12,
  },
  filterScroll: {
    alignItems: 'center',
    gap: 8,
  },
  loadingWrap: {
    padding: appSpacing.xl,
  },
  listContent: {
    padding: appSpacing.xl,
    paddingBottom: 100,
  },
  msgCard: {
    padding: appSpacing.lg,
    marginBottom: 16,
  },
  unreadCardBorder: {
    borderColor: `${appColors.accent}50`,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: appRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  senderName: {
    ...appTypography.bodyBold,
    color: appColors.textPrimary,
  },
  senderEmail: {
    ...appTypography.caption,
    color: appColors.textSecondary,
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    ...appTypography.caption,
    color: appColors.textMuted,
    fontSize: 11,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appColors.elevatedSurface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: appRadius.full,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  metaText: {
    ...appTypography.captionBold,
    color: appColors.textSecondary,
    fontSize: 11,
  },
  messageBox: {
    backgroundColor: `${appColors.background}80`,
    padding: appSpacing.md,
    borderRadius: appRadius.md,
    borderWidth: 1,
    borderColor: appColors.border,
    marginBottom: 16,
  },
  messageContent: {
    ...appTypography.body,
    color: appColors.textPrimary,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: appRadius.sm,
    backgroundColor: '#EF444415',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EF444430',
  },
});


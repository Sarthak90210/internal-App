import React, { useEffect, useState, useMemo } from 'react';
import { View, FlatList, StyleSheet, Alert, Pressable, Switch } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Feather from '@expo/vector-icons/Feather';
import { SocialsService } from '../../services/socials';
import {
  AppSearchBar,
  AppListItem,
  AppFAB,
  AppModal,
  AppInput,
  AppButton,
  AppBadge,
  AppSkeleton,
  AppEmptyState,
} from '../../components/design-system';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';

// Keys MUST match the website's SocialsTab ICON_OPTIONS so a link created here
// renders with the right brand icon in the footer / link tree. Only the glyph
// family used to *preview* it in the app differs (native @expo/vector-icons
// instead of react-icons).
const SOCIAL_ICONS = [
  { key: 'instagram', label: 'Instagram', family: 'mci', glyph: 'instagram' },
  { key: 'youtube', label: 'YouTube', family: 'mci', glyph: 'youtube' },
  { key: 'linkedin', label: 'LinkedIn', family: 'mci', glyph: 'linkedin' },
  { key: 'twitter', label: 'Twitter / X', family: 'mci', glyph: 'twitter' },
  { key: 'github', label: 'GitHub', family: 'mci', glyph: 'github' },
  { key: 'facebook', label: 'Facebook', family: 'mci', glyph: 'facebook' },
  { key: 'whatsapp', label: 'WhatsApp', family: 'mci', glyph: 'whatsapp' },
  { key: 'discord', label: 'Discord', family: 'mci', glyph: 'discord' },
  { key: 'telegram', label: 'Telegram', family: 'mci', glyph: 'telegram' },
  { key: 'spotify', label: 'Spotify', family: 'mci', glyph: 'spotify' },
  { key: 'twitch', label: 'Twitch', family: 'mci', glyph: 'twitch' },
  { key: 'threads', label: 'Threads', family: 'mci', glyph: 'at' },
  { key: 'mail', label: 'Email', family: 'feather', glyph: 'mail' },
  { key: 'globe', label: 'Website', family: 'feather', glyph: 'globe' },
  { key: 'link', label: 'Link', family: 'feather', glyph: 'link' },
  { key: 'phone', label: 'Phone', family: 'feather', glyph: 'phone' },
  { key: 'location', label: 'Location', family: 'feather', glyph: 'map-pin' },
  { key: 'music', label: 'Music', family: 'feather', glyph: 'music' },
  { key: 'shop', label: 'Shop', family: 'feather', glyph: 'shopping-bag' },
  { key: 'blog', label: 'Blog / Document', family: 'feather', glyph: 'file-text' },
  { key: 'calendar', label: 'Calendar', family: 'feather', glyph: 'calendar' },
  { key: 'team', label: 'Team', family: 'feather', glyph: 'users' },
  { key: 'rss', label: 'RSS', family: 'feather', glyph: 'rss' },
  { key: 'podcast', label: 'Podcast', family: 'mci', glyph: 'podcast' },
  { key: 'external', label: 'External Link', family: 'feather', glyph: 'external-link' },
];

const ICON_BY_KEY = Object.fromEntries(SOCIAL_ICONS.map((o) => [o.key, o]));

const SocialIcon = ({ iconKey, size = 18, color }) => {
  const opt = ICON_BY_KEY[iconKey] || ICON_BY_KEY.link;
  const Family = opt.family === 'mci' ? MaterialCommunityIcons : Feather;
  return <Family name={opt.glyph} size={size} color={color} />;
};

const EMPTY_FORM = { title: '', url: '', icon: 'link', order: '10', enabled: true };

export default function ManageSocialsScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = SocialsService.subscribeToSocials((data) => {
      setItems(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((s) => s.title?.toLowerCase().includes(q) || s.url?.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const openAddModal = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setFormData({
      title: item.title || '',
      url: item.url || '',
      icon: item.icon || 'link',
      order: String(item.order ?? 10),
      enabled: item.enabled !== false,
    });
    setEditingId(item.id);
    setModalVisible(true);
  };

  const handleDelete = (item) => {
    Alert.alert('Delete Social Link', `Permanently delete "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => SocialsService.deleteSocial(item) },
    ]);
  };

  const handleSave = async () => {
    const title = formData.title.trim();
    const url = formData.url.trim();
    if (!title || !url) {
      Alert.alert('Required Fields', 'Both a title and a URL are required.');
      return;
    }

    setIsSaving(true);
    try {
      const dataToSave = {
        title,
        url,
        icon: formData.icon,
        order: Number(formData.order) || 0,
        enabled: formData.enabled,
      };
      if (editingId) {
        await SocialsService.updateSocial(editingId, dataToSave);
      } else {
        await SocialsService.addSocial(dataToSave);
      }
      setModalVisible(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to save. You might not have permission.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <AppSearchBar
          placeholder="Search links by title or URL..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <AppSkeleton width="100%" height={72} style={{ marginBottom: 12 }} />
          <AppSkeleton width="100%" height={72} style={{ marginBottom: 12 }} />
          <AppSkeleton width="100%" height={72} />
        </View>
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isHidden = item.enabled === false;
            return (
              <AppListItem
                title={item.title || 'Untitled'}
                description={item.url}
                style={isHidden && { opacity: 0.55 }}
                leftIcon={
                  <View style={styles.iconBox}>
                    <SocialIcon iconKey={item.icon} size={20} color={appColors.accent} />
                  </View>
                }
                rightElement={
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <AppBadge variant={isHidden ? 'warning' : 'primary'}>
                      {isHidden ? 'Hidden' : `#${item.order ?? 0}`}
                    </AppBadge>
                  </View>
                }
                onPress={() => openEditModal(item)}
                onDelete={() => handleDelete(item)}
              />
            );
          }}
          ListEmptyComponent={
            <AppEmptyState
              title="No social links yet"
              description={
                searchQuery
                  ? 'No results matched your search.'
                  : 'Add links that appear on socials.teamrotorfpv.com and the website footer.'
              }
              actionLabel={searchQuery ? undefined : 'Add First Link'}
              onAction={searchQuery ? undefined : openAddModal}
            />
          }
        />
      )}

      <AppFAB label="New Link" onPress={openAddModal} />

      <AppModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingId ? 'Edit Social Link' : 'Add Social Link'}
        footer={
          <View style={styles.modalFooter}>
            <AppButton
              variant="ghost"
              onPress={() => setModalVisible(false)}
              style={{ flex: 1, marginRight: 8 }}
              disabled={isSaving}
            >
              Cancel
            </AppButton>
            <AppButton variant="primary" onPress={handleSave} style={{ flex: 1 }} loading={isSaving}>
              {editingId ? 'Update Link' : 'Add Link'}
            </AppButton>
          </View>
        }
      >
        <AppInput
          label="Title"
          value={formData.title}
          onChangeText={(t) => setFormData({ ...formData, title: t })}
          placeholder="e.g. Instagram"
        />

        <View style={{ marginTop: 16 }}>
          <AppInput
            label="URL"
            value={formData.url}
            onChangeText={(t) => setFormData({ ...formData, url: t })}
            placeholder="https://instagram.com/teamrotorfpv"
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

        <Text style={styles.pickerLabel}>Icon</Text>
        <View style={styles.iconGrid}>
          {SOCIAL_ICONS.map((opt) => {
            const selected = formData.icon === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setFormData({ ...formData, icon: opt.key })}
                style={[styles.iconTile, selected && styles.iconTileSelected]}
                accessibilityLabel={opt.label}
              >
                <SocialIcon
                  iconKey={opt.key}
                  size={20}
                  color={selected ? appColors.accent : appColors.textSecondary}
                />
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.iconHint}>{ICON_BY_KEY[formData.icon]?.label || 'Link'}</Text>

        <View style={{ marginTop: 16 }}>
          <AppInput
            label="Order (lower shows first)"
            value={String(formData.order)}
            onChangeText={(t) => setFormData({ ...formData, order: t })}
            keyboardType="numeric"
            placeholder="10"
          />
        </View>

        <View style={styles.enabledRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.enabledTitle}>Visible on link tree & footer</Text>
            <Text style={styles.enabledSub}>Turn off to hide without deleting.</Text>
          </View>
          <Switch
            value={formData.enabled}
            onValueChange={(v) => setFormData({ ...formData, enabled: v })}
            trackColor={{ false: appColors.border, true: appColors.accent }}
            thumbColor="#FFFFFF"
          />
        </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background,
  },
  searchWrap: {
    paddingHorizontal: appSpacing.xl,
    paddingTop: 12,
    paddingBottom: 4,
  },
  loadingWrap: {
    padding: appSpacing.xl,
  },
  listContent: {
    padding: appSpacing.xl,
    paddingBottom: 100,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: appRadius.md,
    backgroundColor: `${appColors.accent}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerLabel: {
    ...appTypography.caption,
    color: appColors.textSecondary,
    marginTop: 18,
    marginBottom: 10,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: appRadius.md,
    borderWidth: 1,
    borderColor: appColors.border,
    backgroundColor: appColors.elevatedSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileSelected: {
    borderColor: appColors.accent,
    backgroundColor: `${appColors.accent}18`,
  },
  iconHint: {
    ...appTypography.caption,
    color: appColors.textMuted,
    marginTop: 8,
  },
  enabledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: appColors.border,
  },
  enabledTitle: {
    ...appTypography.body,
    fontWeight: '600',
  },
  enabledSub: {
    ...appTypography.caption,
    color: appColors.textMuted,
    marginTop: 2,
  },
});

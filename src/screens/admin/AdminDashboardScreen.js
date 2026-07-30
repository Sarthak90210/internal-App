import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { 
  Images, 
  Award, 
  Layout, 
  Trophy, 
  Users, 
  Calendar, 
  MessageSquare, 
  UserCog,
  Share2,
  ChevronRight,
  QrCode
} from '../../lib/lucideIcons';
import { useAuthStore } from '../../stores/authStore';
import { AppCard } from '../../components/design-system';
import { appColors, appRadius, appSpacing, appTypography } from '../../theme';

const adminModules = [
  { title: "Gallery", route: "ManageGallery", icon: Images, permission: "media", color: "#38BDF8", desc: "Photos & videos" },
  { title: "Sponsors", route: "ManageSponsors", icon: Award, permission: "board", color: "#A855F7", desc: "Partners & tiers" },
  { title: "Home Page", route: "ManageHomeSettings", icon: Layout, permission: "admin", color: "#3B82F6", desc: "Hero & announcements" },
  { title: "Achievements", route: "ManageAchievements", icon: Trophy, permission: "board", color: "#F59E0B", desc: "Awards & milestones" },
  { title: "Board", route: "ManageTeam", icon: Users, permission: "board", color: "#EC4899", desc: "Leadership structure" },
  { title: "Events", route: "ManageEvents", icon: Calendar, permission: "board", color: "#10B981", desc: "Schedule & RSVP" },
  { title: "Messages", route: "ManageContactMessages", icon: MessageSquare, permission: "board", color: "#6366F1", desc: "Inquiries & inbox" },
  { title: "Team Members", route: "ManageTeamMembers", icon: UserCog, permission: "superAdmin", color: "#8B5CF6", desc: "Roster & permissions" },
  { title: "Socials", route: "ManageSocials", icon: Share2, permission: "board", color: "#F472B6", desc: "Footer & link tree" },
  { title: "QR Tags", route: "ManageTags", icon: QrCode, permission: "inventory", color: "#14B8A6", desc: "Generate & print tags" },
];

export default function AdminDashboardScreen({ navigation }) {
  const { hasPermission } = useAuthStore();

  return (
    <ScrollView 
      keyboardShouldPersistTaps="handled"
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard Overview</Text>
        <Text style={styles.subtitle}>Select a module to manage platform data and configuration</Text>
      </View>
      
      <View style={styles.grid}>
        {adminModules.map((module) => {
          const canAccess = hasPermission(module.permission);
          if (!canAccess) return null;

          const IconComponent = module.icon;

          return (
            <View key={module.route} style={styles.cardWrapper}>
              <AppCard 
                style={styles.card} 
                onPress={() => navigation.navigate(module.route)}
                elevated={false}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.iconBox, { backgroundColor: `${module.color}15`, borderColor: `${module.color}30` }]}>
                    <IconComponent size={18} color={module.color} />
                  </View>
                  <ChevronRight size={16} color={appColors.textMuted} />
                </View>
                
                <Text style={styles.moduleTitle}>{module.title}</Text>
                <Text style={styles.moduleDesc} numberOfLines={1}>{module.desc}</Text>
              </AppCard>
            </View>
          );
        })}
      </View>
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: appColors.background,
  },
  content: {
    padding: appSpacing.xl,
  },
  header: {
    marginBottom: appSpacing.xl,
  },
  title: {
    ...appTypography.pageTitle,
    fontSize: 24,
    color: appColors.textPrimary,
  },
  subtitle: {
    ...appTypography.caption,
    color: appColors.textMuted,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  cardWrapper: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  card: {
    padding: appSpacing.lg,
    height: 124,
    justifyContent: 'space-between',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: appRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  moduleTitle: {
    ...appTypography.sectionTitle,
    fontSize: 15,
    color: appColors.textPrimary,
    marginBottom: 2,
  },
  moduleDesc: {
    ...appTypography.caption,
    fontSize: 12,
    color: appColors.textSecondary,
  },
});


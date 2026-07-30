// Drop-in replacement for the lucide-react-native icons the app uses.
//
// Why this exists: lucide-react-native renders every icon through
// react-native-svg, a NATIVE module that is not present in the shipped APK.
// Switching to it and delivering the change over-the-air (expo-updates ships
// JS only, never native code) is what broke the app — SVG views couldn't
// mount, so the UI failed to commit its first frame (blank until the screen
// was toggled), ran slow, and froze the image picker.
//
// @expo/vector-icons draws from native font glyphs that ARE already bundled in
// the binary, so this rides an OTA update cleanly. Each export mirrors lucide's
// prop shape ({ size, color, strokeWidth }); strokeWidth is accepted and
// ignored since font glyphs have a fixed weight.
import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { appColors } from '../theme';

const make = (Family, glyph) => {
  const Icon = ({ size = 24, color, strokeWidth, absoluteStrokeWidth, ...rest }) => (
    <Family name={glyph} size={size} color={color ?? appColors.textPrimary} {...rest} />
  );
  Icon.displayName = glyph;
  return Icon;
};

const F = (glyph) => make(Feather, glyph);
const M = (glyph) => make(MaterialCommunityIcons, glyph);
const I = (glyph) => make(Ionicons, glyph);

export const AlertCircle = F('alert-circle');
export const AlertTriangle = F('alert-triangle');
export const Archive = F('archive');
export const ArchiveRestore = M('archive-arrow-up');
export const ArrowRightLeft = M('swap-horizontal');
export const Award = F('award');
export const Ban = M('block-helper');
export const Box = F('box');
export const Briefcase = F('briefcase');
export const Building2 = M('office-building');
export const Calendar = F('calendar');
export const Camera = F('camera');
export const Check = F('check');
export const CheckCircle = F('check-circle');
export const CheckCircle2 = F('check-circle');
export const CheckSquare = F('check-square');
export const ChevronDown = F('chevron-down');
export const ChevronRight = F('chevron-right');
export const Clock = F('clock');
export const CloudDownload = F('download-cloud');
export const CornerDownRight = F('corner-down-right');
export const DollarSign = F('dollar-sign');
export const Download = F('download');
export const Edit2 = F('edit-2');
export const ExternalLink = F('external-link');
export const Eye = F('eye');
export const EyeOff = F('eye-off');
export const FileText = F('file-text');
export const Folder = F('folder');
export const Hash = F('hash');
export const Keyboard = M('keyboard-outline');
export const Flashlight = M('flashlight');
export const Maximize = F('maximize');
export const QrCode = M('qrcode-scan');
export const Zap = F('zap');
export const Image = F('image');
export const Images = M('image-multiple');
export const Inbox = F('inbox');
export const Layers = F('layers');
export const Layout = F('layout');
export const LayoutGrid = F('grid');
export const ListFilter = F('filter');
export const LogOut = F('log-out');
export const Mail = F('mail');
export const MailOpen = M('email-open-outline');
export const MessageSquare = F('message-square');
export const MoreVertical = F('more-vertical');
export const Phone = F('phone');
export const Plus = F('plus');
export const RefreshCw = F('refresh-cw');
export const Reply = M('reply');
export const RotateCcw = F('rotate-ccw');
export const Search = F('search');
export const Settings = F('settings');
export const Share2 = F('share-2');
export const Globe = F('globe');
export const Link = F('link');
export const ShieldAlert = M('shield-alert');
export const Sparkles = I('sparkles');
export const Square = F('square');
export const Table = M('table');
export const Tag = F('tag');
export const Trash2 = F('trash-2');
export const Trophy = M('trophy');
export const Upload = F('upload');
export const User = F('user');
export const UserCheck = F('user-check');
export const UserCog = M('account-cog');
export const UserX = F('user-x');
export const Users = F('users');
export const Video = F('video');
export const Wrench = F('tool');
export const X = F('x');

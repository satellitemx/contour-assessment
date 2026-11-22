import type { Locale, PermissionKey } from '@/lib/types';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'zh-CN'] as const;
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE_NAME = 'contour_locale';

export type PermissionGroupKey =
  | 'Student Consultations'
  | 'System Administration'
  | 'Access Control';

export interface TranslationDictionary {
  common: {
    appName: string;
    appTagline: string;
    loading: string;
    cancel: string;
    save: string;
    delete: string;
    none: string;
    languageLabel: string;
    englishOption: string;
    simplifiedChineseOption: string;
  };
  nav: {
    workspaceHeading: string;
    noCapabilities: string;
    noRolesAssigned: string;
    settings: string;
    signOut: string;
    toggleMenu: string;
    toggleColorScheme: string;
    switchToLight: string;
    switchToDark: string;
    items: {
      dashboard: { label: string; description: string };
      'admin-consultations': { label: string; description: string };
      'admin-roles': { label: string; description: string };
    };
  };
  auth: {
    loginTitle: string;
    loginSubtitle: string;
    emailLabel: string;
    emailPlaceholder: string;
    emailInvalid: string;
    passwordLabel: string;
    passwordPlaceholderLogin: string;
    passwordRequired: string;
    signInButton: string;
    loginGenericError: string;
    callbackError: string;
    noAccountPrompt: string;
    createAccountLink: string;
    signupTitle: string;
    signupSubtitle: string;
    firstNameLabel: string;
    firstNamePlaceholder: string;
    firstNameRequired: string;
    lastNameLabel: string;
    lastNamePlaceholder: string;
    lastNameRequired: string;
    signupEmailPlaceholder: string;
    passwordPlaceholderSignup: string;
    passwordDescription: string;
    passwordMinError: string;
    createAccountButton: string;
    signupGenericError: string;
    confirmEmailTitle: string;
    confirmEmailBody: string;
    goToSignInButton: string;
    hasAccountPrompt: string;
    signInLink: string;
  };
  consultationStatus: {
    all: string;
    scheduled: string;
    completed: string;
    cancelled: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    bookButton: string;
    bookingOnlyTitle: string;
    bookingOnlyBody: string;
    searchPlaceholder: string;
    searchAriaLabel: string;
    loadError: string;
    emptyTitle: string;
    emptyDefaultSubtitle: string;
    emptyFilteredSubtitle: string;
    emptyBookButton: string;
    tableHeaders: {
      attendee: string;
      reason: string;
      schedule: string;
      status: string;
      actions: string;
    };
    stats: {
      total: string;
      scheduled: string;
      completed: string;
      cancelled: string;
    };
    actions: {
      markComplete: string;
      markIncomplete: string;
      reschedule: string;
      cancel: string;
    };
    notifications: {
      markedCompleteTitle: string;
      markedCompleteBody: string;
      markedIncompleteTitle: string;
      markedIncompleteBody: string;
      updateFailedTitle: string;
      updateFailedBody: string;
    };
  };
  booking: {
    modalTitle: string;
    firstNameLabel: string;
    lastNameLabel: string;
    reasonLabel: string;
    reasonPlaceholder: string;
    reasonError: string;
    startsAtLabel: string;
    startsAtPlaceholder: string;
    startsAtRequired: string;
    endsAtLabel: string;
    endsAtPlaceholder: string;
    endsAtRequired: string;
    endsAfterStartsError: string;
    invalidRangeError: string;
    confirmButton: string;
    bookedTitle: string;
    bookedBody: string;
    createError: string;
    startHoursAria: string;
    startMinutesAria: string;
    confirmStartAria: string;
    endHoursAria: string;
    endMinutesAria: string;
    confirmEndAria: string;
  };
  reschedule: {
    modalTitle: string;
    subtitlePrefix: string;
    newStartLabel: string;
    newEndLabel: string;
    saveButton: string;
    successTitle: string;
    successBody: string;
    errorBody: string;
    startHoursAria: string;
    startMinutesAria: string;
    confirmStartAria: string;
    endHoursAria: string;
    endMinutesAria: string;
    confirmEndAria: string;
  };
  cancelModal: {
    modalTitle: string;
    warningTitle: string;
    warningBody: string;
    keepButton: string;
    confirmButton: string;
    successTitle: string;
    successBody: string;
    errorBody: string;
  };
  adminConsultations: {
    title: string;
    readOnlyBadge: string;
    subtitle: string;
    showingCount: string;
    searchPlaceholder: string;
    searchAriaLabel: string;
    loadError: string;
    emptyTitle: string;
    emptySubtitle: string;
    tableHeaders: {
      studentAccount: string;
      attendeeName: string;
      reason: string;
      schedule: string;
      status: string;
    };
  };
  roles: {
    title: string;
    subtitle: string;
    createButton: string;
    rolesTab: string;
    usersTab: string;
    loadError: string;
    systemBadge: string;
    defaultBadge: string;
    slugLabel: string;
    userSingular: string;
    userPlural: string;
    composedAttributesLabel: string;
    editButton: string;
    deleteButton: string;
    deleteModalTitle: string;
    deleteConfirmBefore: string;
    deleteConfirmAfter: string;
    deleteRoleConfirmButton: string;
    deletedTitle: string;
    deletedBody: string;
    deleteFailedTitle: string;
    deleteFailedBody: string;
  };
  roleEditor: {
    editTitlePrefix: string;
    createTitle: string;
    nameLabel: string;
    namePlaceholder: string;
    nameMinError: string;
    slugLabel: string;
    slugPlaceholder: string;
    slugLockedHint: string;
    slugEditableHint: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    defaultSwitchLabel: string;
    defaultSwitchDescription: string;
    composeDivider: string;
    attributesMinError: string;
    saveButton: string;
    createButton: string;
    updatedTitle: string;
    updatedBody: string;
    createdTitle: string;
    createdBody: string;
    saveError: string;
  };
  userRoles: {
    introText: string;
    filterPlaceholder: string;
    filterAriaLabel: string;
    headers: {
      user: string;
      assignedRoles: string;
      effectiveAttributes: string;
      save: string;
    };
    selectPlaceholder: string;
    saveMobileButton: string;
    updatedTitle: string;
    updatedBody: string;
    rejectedTitle: string;
    rejectedBody: string;
  };
  settings: {
    title: string;
    subtitle: string;
    profileSectionTitle: string;
    fullNameLabel: string;
    emailLabel: string;
    rolesLabel: string;
    languageSectionTitle: string;
    languageLabel: string;
    languageDescription: string;
    saveButton: string;
    savedTitle: string;
    savedBody: string;
    saveError: string;
  };
  permissionGuard: {
    verifying: string;
    restrictedTitle: string;
    restrictedAlert: string;
    insufficientHeading: string;
    insufficientBody: string;
    returnButton: string;
  };
  noAccess: {
    alertTitle: string;
    alertBody: string;
    heading: string;
    bodyPrefix: string;
    openWorkspaceButton: string;
    signOutButton: string;
  };
  permissions: {
    groups: Record<PermissionGroupKey, string>;
    entries: Record<PermissionKey, { label: string; description: string }>;
  };
  date: {
    invalidSchedule: string;
  };
}

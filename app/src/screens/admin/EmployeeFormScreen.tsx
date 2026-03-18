import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import AdminScreenContainer from '../../components/AdminScreenContainer';
import AdminScrollContainer from '../../components/AdminScrollContainer';
import PrimaryButton from '../../components/PrimaryButton';
import FormSectionCard from '../../components/ui/FormSectionCard';
import PageHeader from '../../components/ui/PageHeader';
import StatusChip from '../../components/ui/StatusChip';
import SurfaceCard from '../../components/ui/SurfaceCard';
import TextField from '../../components/ui/TextField';
import { useAdminSession } from '../../context/AdminSessionContext';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { EMPLOYEE_PIN_LENGTH } from '../../constants/app';
import {
  createEmployee,
  getEmployeeById,
  updateEmployee,
  type EmployeeProfileInput,
} from '../../services/repositories/employeeRepository';
import { listEmployeePayRates } from '../../services/repositories/employeePayRateRepository';
import { colors, radius, spacing, typography, withAlpha } from '../../theme';
import type { EmployeePayRateRecord } from '../../types/database';
import type { RootStackParamList } from '../../types/navigation';

type EmployeeFormScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AdminEmployeeForm'
>;

type EmployeeFormDraft = {
  name: string;
  jobTitle: string;
  hourlyRateInput: string;
  rateEffectiveDate: string;
  department: string;
  startDate: string;
  photoPath: string;
  address: string;
  email: string;
  phoneNumber: string;
};

function toIsoDateLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDefaultDraft(): EmployeeFormDraft {
  return {
    address: '',
    department: '',
    email: '',
    hourlyRateInput: '',
    jobTitle: '',
    name: '',
    phoneNumber: '',
    photoPath: '',
    rateEffectiveDate: toIsoDateLocal(new Date()),
    startDate: toIsoDateLocal(new Date()),
  };
}

function formatHourlyRate(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) {
    return '';
  }
  if (Number.isInteger(rate)) {
    return String(rate);
  }
  return String(rate);
}

function parseHourlyRate(value: string) {
  const parsed = Number.parseFloat(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [yearPart, monthPart, dayPart] = value.split('-');
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  const day = Number.parseInt(dayPart, 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

export default function EmployeeFormScreen({
  navigation,
  route,
}: EmployeeFormScreenProps) {
  const { isCompactWidth, isVeryCompactWidth } = useResponsiveLayout();
  const { markActivity } = useAdminSession();
  const isCreateMode = route.params.mode === 'create';
  const employeeId = route.params.mode === 'edit' ? route.params.employeeId : null;
  const [draft, setDraft] = useState<EmployeeFormDraft>(() => createDefaultDraft());
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(!isCreateMode);
  const [payRateHistory, setPayRateHistory] = useState<EmployeePayRateRecord[]>([]);

  useEffect(() => {
    let mounted = true;
    const loadEmployee = async () => {
      if (!employeeId) {
        return;
      }
      setIsLoadingEmployee(true);
      try {
        const [employee, rateHistory] = await Promise.all([
          getEmployeeById(employeeId),
          listEmployeePayRates(employeeId),
        ]);
        if (!employee) {
          throw new Error('Employee not found.');
        }
        if (mounted) {
          setDraft({
            address: employee.address ?? '',
            department: employee.department,
            email: employee.email ?? '',
            hourlyRateInput: formatHourlyRate(employee.hourly_rate),
            jobTitle: employee.job_title,
            name: employee.name,
            phoneNumber: employee.phone_number,
            photoPath: employee.photo_path ?? '',
            rateEffectiveDate: toIsoDateLocal(new Date()),
            startDate: employee.start_date || toIsoDateLocal(new Date()),
          });
          setPayRateHistory(rateHistory);
        }
      } catch (loadError) {
        if (mounted) {
          setError(
            loadError instanceof Error ? loadError.message : 'Failed to load employee.',
          );
        }
      } finally {
        if (mounted) {
          setIsLoadingEmployee(false);
        }
      }
    };
    void loadEmployee();
    return () => {
      mounted = false;
    };
  }, [employeeId]);

  const setDraftField = (field: keyof EmployeeFormDraft, value: string) => {
    markActivity();
    setError(null);
    setDraft((current) => ({
      ...current,
      ...(field === 'startDate' && isCreateMode
        ? { rateEffectiveDate: value }
        : {}),
      [field]: value,
    }));
  };

  const buildProfilePayload = (): EmployeeProfileInput | null => {
    if (!draft.name.trim()) {
      setError('Name is required.');
      return null;
    }
    if (!draft.jobTitle.trim()) {
      setError('Job title is required.');
      return null;
    }
    if (!draft.department.trim()) {
      setError('Department is required.');
      return null;
    }
    if (!draft.phoneNumber.trim()) {
      setError('Phone number is required.');
      return null;
    }

    const hourlyRate = parseHourlyRate(draft.hourlyRateInput);
    if (hourlyRate === null) {
      setError('Hourly rate must be greater than 0.');
      return null;
    }

    const normalizedStartDate = draft.startDate.trim();
    if (!isValidIsoDate(normalizedStartDate)) {
      setError('Start date must be in YYYY-MM-DD format.');
      return null;
    }

    const normalizedRateEffectiveDate = draft.rateEffectiveDate.trim();
    if (!isValidIsoDate(normalizedRateEffectiveDate)) {
      setError('Rate effective date must be in YYYY-MM-DD format.');
      return null;
    }

    return {
      address: draft.address,
      department: draft.department,
      email: draft.email,
      hourlyRate,
      jobTitle: draft.jobTitle,
      name: draft.name,
      phoneNumber: draft.phoneNumber,
      photoPath: draft.photoPath,
      rateEffectiveDate: normalizedRateEffectiveDate,
      startDate: normalizedStartDate,
    };
  };

  const saveEmployee = async () => {
    markActivity();
    setError(null);
    const profile = buildProfilePayload();
    if (!profile) {
      return;
    }

    setIsSaving(true);
    try {
      if (isCreateMode) {
        const { pin: generatedPin } = await createEmployee(profile);
        Alert.alert(
          'Employee Created',
          `${profile.name.trim()} has been added.\nAssigned PIN: ${generatedPin}`,
          [
            {
              onPress: () => {
                navigation.goBack();
              },
              text: 'OK',
            },
          ],
        );
      } else if (employeeId) {
        await updateEmployee(employeeId, profile);
        navigation.goBack();
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingEmployee) {
    return (
      <AdminScreenContainer style={styles.centered}>
        <ActivityIndicator color={colors.accents.bronze} />
      </AdminScreenContainer>
    );
  }

  return (
    <AdminScrollContainer>
      <PageHeader
        badgeLabel={isCreateMode ? 'New Profile' : 'Editing'}
        badgeTone="info"
        onBack={() => navigation.goBack()}
        subtitle={
          isCreateMode
            ? 'Create an employee profile with payroll and contact details.'
            : 'Update employee profile details and payroll information.'
        }
        title={isCreateMode ? 'Add Employee' : 'Edit Employee'}
      />

      <View style={styles.formStack}>
        <SurfaceCard padding="lg" style={styles.summaryCard} tone="info">
          <View style={[styles.summaryRow, isCompactWidth ? styles.summaryRowCompact : null]}>
            <View style={styles.summaryIntro}>
              <Text style={styles.summaryEyebrow}>Profile setup</Text>
              <Text style={styles.summaryTitle}>
                {isCreateMode ? 'Create a new employee record' : 'Review and update this employee'}
              </Text>
              <Text style={styles.summarySupport}>
                Keep required payroll details at the top, and use the optional section for supporting admin records.
              </Text>
            </View>

            <View style={styles.summaryStatus}>
              {isCreateMode ? (
                <StatusChip label={`Auto PIN on Save`} tone="info" />
              ) : (
                <StatusChip label="Changes update immediately after save" tone="success" />
              )}
            </View>
          </View>
        </SurfaceCard>

        <FormSectionCard
          style={styles.formCard}
          subtitle="Required identity and role details used across shift records and payroll."
          title="Identity & Role"
        >
          <View style={[styles.fieldRow, isCompactWidth ? styles.fieldRowStacked : null]}>
            <TextField
              autoCapitalize="words"
              containerStyle={styles.fieldColumn}
              description="Shown on clock events and payroll reports."
              label="Name"
              onChangeText={(value) => {
                setDraftField('name', value);
              }}
              placeholder="Employee Name"
              returnKeyType="next"
              value={draft.name}
            />
            <TextField
              autoCapitalize="words"
              containerStyle={styles.fieldColumn}
              description="Current role or position title."
              label="Job Title"
              onChangeText={(value) => {
                setDraftField('jobTitle', value);
              }}
              placeholder="Front Desk Agent"
              returnKeyType="next"
              value={draft.jobTitle}
            />
          </View>

          <View style={[styles.fieldRow, isCompactWidth ? styles.fieldRowStacked : null]}>
            <TextField
              autoCapitalize="words"
              containerStyle={styles.fieldColumn}
              label="Department"
              onChangeText={(value) => {
                setDraftField('department', value);
              }}
              placeholder="Operations"
              returnKeyType="next"
              value={draft.department}
            />
            <TextField
              containerStyle={styles.fieldColumn}
              keyboardType="phone-pad"
              label="Phone Number"
              onChangeText={(value) => {
                setDraftField('phoneNumber', value);
              }}
              placeholder="+1 555 555 1234"
              returnKeyType="next"
              value={draft.phoneNumber}
            />
          </View>
        </FormSectionCard>

        <FormSectionCard
          style={styles.formCard}
          subtitle="These values affect hours calculations and payroll summaries."
          title="Payroll Setup"
        >
          <View style={[styles.fieldRow, isCompactWidth ? styles.fieldRowStacked : null]}>
            <TextField
              containerStyle={styles.fieldColumn}
              description="Base hourly pay rate."
              keyboardType="decimal-pad"
              label="Hourly Rate"
              onChangeText={(value) => {
                setDraftField('hourlyRateInput', value.replace(/[^0-9.]/g, ''));
              }}
              placeholder="18.50"
              returnKeyType="next"
              value={draft.hourlyRateInput}
            />
            <TextField
              containerStyle={styles.fieldColumn}
              description="Use YYYY-MM-DD format."
              label="Start Date"
              onChangeText={(value) => {
                setDraftField('startDate', value);
              }}
              placeholder="2026-03-08"
              returnKeyType="next"
              value={draft.startDate}
            />
          </View>
          <View style={[styles.fieldRow, isCompactWidth ? styles.fieldRowStacked : null]}>
            <TextField
              containerStyle={styles.fieldColumn}
              description="Used when the hourly rate changes. Must be on or after the latest saved rate date."
              label="Rate Effective Date"
              onChangeText={(value) => {
                setDraftField('rateEffectiveDate', value);
              }}
              placeholder="2026-03-08"
              returnKeyType="done"
              value={draft.rateEffectiveDate}
            />
          </View>
          {!isCreateMode && payRateHistory.length > 0 ? (
            <View style={styles.payHistoryBox}>
              <Text style={styles.payHistoryTitle}>Pay Rate History</Text>
              <Text style={styles.payHistorySupport}>
                The current hourly rate is applied from the effective date you save here.
              </Text>
              {payRateHistory.map((entry) => (
                <View key={entry.id} style={styles.payHistoryRow}>
                  <Text style={styles.payHistoryDate}>{entry.effective_start_date}</Text>
                  <Text style={styles.payHistoryRate}>${formatHourlyRate(entry.hourly_rate)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </FormSectionCard>

        <FormSectionCard
          style={styles.formCard}
          subtitle="Optional details help with internal records and contact follow-up."
          title="Contact & Optional Details"
        >
          <TextField
            autoCapitalize="none"
            containerStyle={styles.singleField}
            keyboardType="email-address"
            label="Email"
            onChangeText={(value) => {
              setDraftField('email', value);
            }}
            placeholder="employee@example.com"
            value={draft.email}
          />

          <TextField
            autoCapitalize="sentences"
            containerStyle={styles.singleField}
            label="Address"
            multiline
            onChangeText={(value) => {
              setDraftField('address', value);
            }}
            placeholder="Street, city, state, zip"
            style={styles.multilineField}
            textAlignVertical="top"
            value={draft.address}
          />

          <TextField
            autoCapitalize="none"
            containerStyle={styles.singleField}
            description="Optional image URL or local file path for admin reference."
            label="Picture URL/Path"
            onChangeText={(value) => {
              setDraftField('photoPath', value);
            }}
            placeholder="https://... or local file path"
            value={draft.photoPath}
          />
        </FormSectionCard>

        <FormSectionCard
          footer={
            <View
              style={[
                styles.actions,
                isCompactWidth ? styles.actionsCompact : null,
                isVeryCompactWidth ? styles.actionsStacked : null,
              ]}
            >
              <PrimaryButton
                disabled={isSaving}
                fullWidth={isVeryCompactWidth}
                onPress={() => {
                  void saveEmployee();
                }}
                style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
                title={isSaving ? 'Saving...' : isCreateMode ? 'Save Employee' : 'Save Changes'}
                variant="primary"
              />
              <PrimaryButton
                fullWidth={isVeryCompactWidth}
                onPress={() => {
                  navigation.goBack();
                }}
                style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
                title="Cancel"
                variant="secondary"
              />
            </View>
          }
          style={styles.formCard}
          title={isCreateMode ? 'Save New Employee' : 'Save Changes'}
        >
          <View style={styles.saveIntroRow}>
            <View style={styles.saveIntroText}>
              <Text style={styles.saveIntroTitle}>
                {isCreateMode ? 'PIN assignment' : 'Review before saving'}
              </Text>
              <Text style={styles.saveIntroSupport}>
                {isCreateMode
                  ? `A random unique ${EMPLOYEE_PIN_LENGTH}-digit PIN will be generated on save. You can reset it later from the employee directory.`
                  : 'Saving updates this employee profile, keeps the existing access PIN, and records any hourly-rate change using the rate effective date above.'}
              </Text>
            </View>
            <StatusChip label={isCreateMode ? 'Auto PIN' : 'Update'} tone="info" />
          </View>

          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Required for save</Text>
            <Text style={styles.noteText}>
              Name, job title, department, phone number, hourly rate, a valid start date, and a valid rate effective date.
            </Text>
          </View>

          <Text style={[styles.errorText, !error ? styles.errorTextHidden : null]}>
            {error ?? ' '}
          </Text>
        </FormSectionCard>
      </View>
    </AdminScrollContainer>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionsCompact: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  actionsStacked: {
    flexDirection: 'column',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactActionButton: {
    flex: 1,
  },
  errorText: {
    ...typography.bodySm,
    color: colors.states.danger,
    minHeight: 20,
    marginTop: spacing.md,
  },
  errorTextHidden: {
    color: 'transparent',
  },
  fieldColumn: {
    flex: 1,
    minWidth: 220,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fieldRowStacked: {
    flexDirection: 'column',
  },
  formCard: {
    maxWidth: 980,
    width: '100%',
  },
  formStack: {
    gap: spacing.section,
  },
  multilineField: {
    minHeight: 120,
  },
  noteBox: {
    backgroundColor: colors.backgrounds.secondary,
    borderColor: colors.borders.subtle,
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  noteLabel: {
    ...typography.micro,
    color: colors.text.muted,
    textTransform: 'uppercase',
  },
  noteText: {
    ...typography.bodySm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  payHistoryBox: {
    backgroundColor: colors.backgrounds.secondary,
    borderColor: colors.borders.subtle,
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  payHistoryDate: {
    ...typography.bodySm,
    color: colors.text.primary,
  },
  payHistoryRate: {
    ...typography.bodySm,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  payHistoryRow: {
    alignItems: 'center',
    borderTopColor: colors.borders.subtle,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  payHistorySupport: {
    ...typography.bodySm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  payHistoryTitle: {
    ...typography.cardTitle,
    color: colors.text.primary,
  },
  saveIntroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  saveIntroSupport: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  saveIntroText: {
    flex: 1,
  },
  saveIntroTitle: {
    ...typography.cardTitle,
    color: colors.text.primary,
  },
  singleField: {
    width: '100%',
  },
  summaryCard: {
    maxWidth: 980,
    width: '100%',
  },
  summaryEyebrow: {
    ...typography.micro,
    color: colors.text.muted,
    textTransform: 'uppercase',
  },
  summaryIntro: {
    flex: 1,
    marginRight: spacing.md,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryRowCompact: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: spacing.md,
  },
  summaryStatus: {
    alignItems: 'flex-end',
  },
  summarySupport: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    maxWidth: 620,
  },
  summaryTitle: {
    ...typography.sectionTitle,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
});

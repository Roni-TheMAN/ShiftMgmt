import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import AdminScreenContainer from '../../components/AdminScreenContainer';
import AdminScrollContainer from '../../components/AdminScrollContainer';
import PrimaryButton from '../../components/PrimaryButton';
import PageHeader from '../../components/ui/PageHeader';
import SurfaceCard from '../../components/ui/SurfaceCard';
import TextField from '../../components/ui/TextField';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { useAdminSession } from '../../context/AdminSessionContext';
import { EMPLOYEE_PIN_LENGTH } from '../../constants/app';
import {
  createEmployee,
  getEmployeeById,
  updateEmployee,
  type EmployeeProfileInput,
} from '../../services/repositories/employeeRepository';
import { colors, spacing, typography } from '../../theme';
import type { RootStackParamList } from '../../types/navigation';

type EmployeeFormScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AdminEmployeeForm'
>;

type EmployeeFormDraft = {
  name: string;
  jobTitle: string;
  hourlyRateInput: string;
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

  useEffect(() => {
    let mounted = true;
    const loadEmployee = async () => {
      if (!employeeId) {
        return;
      }
      setIsLoadingEmployee(true);
      try {
        const employee = await getEmployeeById(employeeId);
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
            startDate: employee.start_date || toIsoDateLocal(new Date()),
          });
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

    return {
      address: draft.address,
      department: draft.department,
      email: draft.email,
      hourlyRate,
      jobTitle: draft.jobTitle,
      name: draft.name,
      phoneNumber: draft.phoneNumber,
      photoPath: draft.photoPath,
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
        <ActivityIndicator color={colors.primary} />
      </AdminScreenContainer>
    );
  }

  return (
    <AdminScrollContainer>
      <PageHeader
        onBack={() => navigation.goBack()}
        subtitle={
          isCreateMode
            ? 'Create an employee profile with payroll and contact details.'
            : 'Update employee profile details.'
        }
        title={isCreateMode ? 'Add Employee' : 'Edit Employee'}
      />

      <View style={styles.formStack}>
        <SurfaceCard padding="lg" style={styles.formCard}>
          <Text style={styles.sectionTitle}>Employment Details</Text>
          <Text style={styles.sectionCaption}>
            Required fields used for payroll and shift records.
          </Text>

          <View style={[styles.fieldRow, isCompactWidth ? styles.fieldRowStacked : null]}>
            <TextField
              autoCapitalize="words"
              containerStyle={styles.fieldColumn}
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

          <View style={[styles.fieldRow, isCompactWidth ? styles.fieldRowStacked : null]}>
            <TextField
              containerStyle={styles.fieldColumn}
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
              label="Start Date (YYYY-MM-DD)"
              onChangeText={(value) => {
                setDraftField('startDate', value);
              }}
              placeholder="2026-03-08"
              returnKeyType="next"
              value={draft.startDate}
            />
          </View>
        </SurfaceCard>

        <SurfaceCard padding="lg" style={styles.formCard}>
          <Text style={styles.sectionTitle}>Contact and Optional Details</Text>

          <TextField
            autoCapitalize="none"
            containerStyle={styles.singleField}
            keyboardType="email-address"
            label="Email (Optional)"
            onChangeText={(value) => {
              setDraftField('email', value);
            }}
            placeholder="employee@example.com"
            value={draft.email}
          />

          <TextField
            autoCapitalize="sentences"
            containerStyle={styles.singleField}
            label="Address (Optional)"
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
            label="Picture URL/Path (Optional)"
            onChangeText={(value) => {
              setDraftField('photoPath', value);
            }}
            placeholder="https://... or local file path"
            value={draft.photoPath}
          />
        </SurfaceCard>

        <SurfaceCard padding="lg" style={styles.formCard}>
          <Text style={styles.sectionTitle}>{isCreateMode ? 'PIN Setup' : 'Save Changes'}</Text>
          {isCreateMode ? (
            <Text style={styles.helperText}>
              A random unique {EMPLOYEE_PIN_LENGTH}-digit PIN will be generated on save.
              {'\n'}
              Use the employee list Reset PIN action later if needed.
            </Text>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
              title={isSaving ? 'Saving...' : 'Save Employee'}
              variant="success"
            />
            <PrimaryButton
              fullWidth={isVeryCompactWidth}
              onPress={() => {
                navigation.goBack();
              }}
              style={isCompactWidth && !isVeryCompactWidth ? styles.compactActionButton : undefined}
              title="Cancel"
              variant="neutral"
            />
          </View>
        </SurfaceCard>
      </View>
    </AdminScrollContainer>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
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
    ...typography.label,
    color: colors.danger,
    marginTop: spacing.md,
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
    gap: 0,
  },
  formCard: {
    maxWidth: 920,
    width: '100%',
  },
  formStack: {
    gap: spacing.md,
  },
  helperText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  multilineField: {
    minHeight: 96,
  },
  sectionCaption: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  singleField: {
    width: '100%',
  },
});

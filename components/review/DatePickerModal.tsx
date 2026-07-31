import React from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { HouseNavHeader } from '@/components/ui/HouseNavHeader';
import { HouseToolbarIconButton } from '@/components/ui/HouseToolbarIconButton';
import { GustraColors } from '@/constants/Colors';
import { Theme, bodyTextStyle, captionTextStyle } from '@/constants/Theme';

type DatePickerModalProps = {
  visible: boolean;
  visitDate: Date;
  setVisitDate: (date: Date) => void;
  datePickerMode: 'date' | 'time';
  setDatePickerMode: (mode: 'date' | 'time') => void;
  onClose: () => void;
  activeIntlLocale: () => string;
  t: (key: string, options?: any) => string;
};

export const DatePickerModal = React.memo(function DatePickerModal({
  visible,
  visitDate,
  setVisitDate,
  datePickerMode,
  setDatePickerMode,
  onClose,
  activeIntlLocale,
  t,
}: DatePickerModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.dateModal}>
        <HouseNavHeader
          title={t('forms.review.visitDate')}
          right={
            <HouseToolbarIconButton
              iosName="checkmark"
              androidName="check"
              accessibilityLabel={t('forms.review.done')}
              onPress={onClose}
            />
          }
        />
        <ScrollView contentContainerStyle={styles.dateModalBody}>
          <DateTimePicker
            value={visitDate}
            mode={datePickerMode}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            maximumDate={new Date()}
            themeVariant="light"
            accentColor={GustraColors.forestGreen}
            onChange={(_, selected) => {
              if (Platform.OS === 'android') {
                onClose();
              }
              if (!selected) return;
              setVisitDate(selected);
            }}
          />
          {Platform.OS === 'ios' ? (
            <View style={styles.timeBlock}>
              <Text style={styles.timeCaption}>
                {t('forms.review.time')}
              </Text>
              <DateTimePicker
                value={visitDate}
                mode="time"
                display="spinner"
                maximumDate={new Date()}
                themeVariant="light"
                accentColor={GustraColors.forestGreen}
                onChange={(_, selected) => {
                  if (!selected) return;
                  setVisitDate(selected);
                }}
              />
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setDatePickerMode('time');
              }}
              style={styles.androidTimeBtn}>
              <Text style={styles.dateLabel}>
                {t('forms.review.setTime', {
                  time: visitDate.toLocaleTimeString(activeIntlLocale(), {
                    hour: 'numeric',
                    minute: '2-digit',
                  }),
                })}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  dateModal: {
    flex: 1,
    backgroundColor: GustraColors.cream,
  },
  dateModalBody: {
    padding: 16,
    gap: 20,
  },
  timeBlock: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(35, 32, 26, 0.08)',
    paddingTop: 16,
    gap: 8,
  },
  timeCaption: {
    ...captionTextStyle,
    fontSize: 14,
    color: 'rgba(35, 32, 26, 0.4)',
    textAlign: 'center',
    fontWeight: '600',
  },
  androidTimeBtn: {
    backgroundColor: 'rgba(36, 78, 57, 0.08)',
    borderRadius: Theme.radius.lg,
    padding: 14,
    alignItems: 'center',
  },
  dateLabel: {
    ...bodyTextStyle,
    fontSize: 16,
    fontWeight: '600',
    color: GustraColors.forestGreen,
  },
});

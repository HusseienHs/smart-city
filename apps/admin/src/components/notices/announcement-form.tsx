'use client';

import {
  ANNOUNCEMENT_BODY_MAX_LENGTH,
  ANNOUNCEMENT_IMAGE_TYPES,
  ANNOUNCEMENT_SEVERITIES,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  announcementImageProblem,
  type AnnouncementSeverity,
  type Locale,
  type LocalizedText,
} from '@smart-city/shared';
import { useActionState, useEffect, useState, type ComponentProps } from 'react';

import { Alert } from '@/components/ui/alert';
import { Field, Select, TextInput } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { SubmitButton } from '@/components/ui/submit-button';
import { cn } from '@/lib/cn';
import { saveAnnouncementAction } from '@/lib/notices/actions';
import type { NoticeStrings } from '@/lib/notices/strings';
import { translatorFor } from '@/lib/reports/strings';
import type { StaffActionState } from '@/lib/staff/actions';

const initial: StaffActionState = { status: 'idle' };

const LANGUAGES = [
  { code: 'he', dir: 'rtl' },
  { code: 'ar', dir: 'rtl' },
  { code: 'en', dir: 'ltr' },
] as const;

const SUFFIX = { he: 'He', ar: 'Ar', en: 'En' } as const;

/** Each language's own name (an autonym, the same in every interface language). */
const AUTONYM = { he: 'עברית', ar: 'العربية', en: 'English' } as const;

function TextArea({
  invalid,
  className,
  ...props
}: ComponentProps<'textarea'> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        'min-h-28 w-full rounded-sm border bg-surface px-3 py-2 text-base text-foreground shadow-xs transition-[border-color,box-shadow] duration-150',
        'placeholder:text-subtle focus:border-primary focus:ring-3 focus:ring-primary/15 focus:outline-none',
        invalid ? 'border-danger focus:border-danger focus:ring-danger/15' : 'border-border-strong',
        className,
      )}
      {...props}
    />
  );
}

/** `datetime-local` value (the browser's time zone) → ISO timestamp, or '' if empty/invalid. */
function toIso(local: string): string {
  if (!local) return '';
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

/** ISO timestamp → `datetime-local` value in the browser's time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export interface Option {
  id: string;
  name: string;
}

/** The announcement being edited (absent when creating). */
export interface EditableAnnouncement {
  id: string;
  title: LocalizedText;
  body: LocalizedText;
  severity: AnnouncementSeverity;
  neighborhoodId: string | null;
  expiresAt: string | null;
  departmentName: string;
  published: boolean;
  /** A short-lived preview URL of the current image, if it has one. */
  imageUrl: string | null;
  hasImage: boolean;
}

/**
 * Creates or edits an announcement: title and text in Hebrew (required), Arabic and English;
 * severity; audience (whole municipality or one neighborhood); department (admins choose when
 * creating, others post for their own); optional expiry and image; and, for publishers creating
 * one, "publish immediately". Validated again by the Server Action, storage and the database.
 */
export function AnnouncementForm({
  locale,
  strings,
  departments,
  neighborhoods,
  ownDepartmentName,
  canPublishOwn,
  announcement,
}: {
  locale: Locale;
  strings: NoticeStrings;
  /** Choices for admins creating one (null = their own department, shown read-only). */
  departments: Option[] | null;
  neighborhoods: Option[];
  ownDepartmentName: string | null;
  /** Whether the caller may publish what they create (admins, managers). */
  canPublishOwn: boolean;
  announcement?: EditableAnnouncement;
}) {
  const t = translatorFor(strings);
  const [state, action] = useActionState(saveAnnouncementAction, initial);
  const errors = state.status === 'error' ? (state.fieldErrors ?? {}) : {};
  const typed = state.status === 'error' ? state.values : undefined;
  const [expiresLocal, setExpiresLocal] = useState(
    typed?.expiresAtLocal ?? toLocalInput(announcement?.expiresAt ?? null),
  );
  const [imageError, setImageError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(typed?.removeImage === 'true');
  const optional = t('adminNotices.form.optional');
  const editing = Boolean(announcement);

  // After a successful save the form resets its file input; forget the local preview too.
  const [seenKey, setSeenKey] = useState(state.key);
  if (state.key !== seenKey) {
    setSeenKey(state.key);
    if (state.status === 'success') {
      setPreview(null);
      setRemoveImage(false);
    }
  }

  // Revoke the local preview URL when it is replaced or the form goes away.
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  const textValue = (name: string, field: 'title' | 'body', code: 'he' | 'ar' | 'en') =>
    typed?.[name] ?? announcement?.[field][code] ?? '';

  return (
    <form action={action} noValidate className="flex animate-enter flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      {announcement ? <input type="hidden" name="announcementId" value={announcement.id} /> : null}
      <input type="hidden" name="expiresAt" value={toIso(expiresLocal)} />
      {state.status === 'success' && state.message ? (
        <Alert tone="success">{state.message}</Alert>
      ) : null}
      {state.status === 'error' && state.message && !state.fieldErrors ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}
      {announcement?.published ? (
        <Alert tone="warning">{t('adminNotices.form.publishedEditNotice')}</Alert>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Content: one card per language, Hebrew first (required). */}
        <div className="flex min-w-0 flex-col gap-4">
          {LANGUAGES.map(({ code, dir }) => {
            const titleName = `title${SUFFIX[code]}`;
            const bodyName = `body${SUFFIX[code]}`;
            return (
              <section
                key={code}
                aria-label={AUTONYM[code]}
                className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs"
              >
                <header className="flex items-center gap-3 border-b border-border bg-surface-subtle px-5 py-3">
                  <span
                    aria-hidden
                    className={cn(
                      'flex h-6 w-9 items-center justify-center rounded-md font-mono text-[11px] font-medium uppercase',
                      code === 'he'
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-muted text-muted ring-1 ring-border ring-inset',
                    )}
                  >
                    {code}
                  </span>
                  <span lang={code} className="text-sm font-semibold text-foreground">
                    {AUTONYM[code]}
                  </span>
                  <span className="ms-auto text-xs text-muted">
                    {code === 'he' ? t('adminNotices.form.heHint') : optional}
                  </span>
                </header>
                <div className="flex flex-col gap-4 p-5">
                  <Field
                    label={t(`adminNotices.form.${titleName}` as never)}
                    error={errors[titleName]}
                  >
                    {({ id, describedBy, invalid }) => (
                      <TextInput
                        id={id}
                        name={titleName}
                        dir={dir}
                        lang={code}
                        required={code === 'he'}
                        maxLength={ANNOUNCEMENT_TITLE_MAX_LENGTH}
                        defaultValue={textValue(titleName, 'title', code)}
                        aria-describedby={describedBy}
                        invalid={invalid}
                        className="h-11 text-md font-medium"
                      />
                    )}
                  </Field>
                  <Field
                    label={t(`adminNotices.form.${bodyName}` as never)}
                    error={errors[bodyName]}
                  >
                    {({ id, describedBy, invalid }) => (
                      <TextArea
                        id={id}
                        name={bodyName}
                        dir={dir}
                        lang={code}
                        rows={5}
                        required={code === 'he'}
                        maxLength={ANNOUNCEMENT_BODY_MAX_LENGTH}
                        defaultValue={textValue(bodyName, 'body', code)}
                        aria-describedby={describedBy}
                        invalid={invalid}
                      />
                    )}
                  </Field>
                </div>
              </section>
            );
          })}
        </div>

        {/* Publishing: who sees it, how loud, for how long, and the submit. */}
        <aside className="flex min-w-0 flex-col gap-5 rounded-xl border border-border bg-surface p-5 shadow-xs xl:sticky xl:top-[calc(var(--header-height)+1.5rem)]">
          <div className="grid gap-4">
            <Field
              label={t('adminNotices.form.severity')}
              hint={t('adminNotices.form.severityHint')}
              error={errors.severity}
            >
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  name="severity"
                  defaultValue={typed?.severity ?? announcement?.severity ?? 'info'}
                  aria-describedby={describedBy}
                  invalid={invalid}
                >
                  {ANNOUNCEMENT_SEVERITIES.map((severity) => (
                    <option key={severity} value={severity}>
                      {t(`notices.severity.${severity}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              label={t('adminNotices.form.expiresAt')}
              hint={t('adminNotices.form.expiresAtHint')}
              error={errors.expiresAt}
            >
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  name="expiresAtLocal"
                  type="datetime-local"
                  dir="ltr"
                  value={expiresLocal}
                  onChange={(event) => setExpiresLocal(event.target.value)}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 border-t border-border pt-5">
            {departments && !editing ? (
              <Field label={t('adminNotices.form.department')} error={errors.departmentId}>
                {({ id, describedBy, invalid }) => (
                  <Select
                    id={id}
                    name="departmentId"
                    defaultValue={typed?.departmentId ?? ''}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  >
                    <option value="">{t('adminNotices.municipalityWide')}</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-foreground">
                  {t('adminNotices.form.department')}
                </span>
                <p className="flex h-10 items-center gap-2 rounded-md border border-border bg-surface-muted px-3.5 text-sm text-foreground">
                  <Icon name="departments" className="size-4 text-subtle" />
                  {announcement
                    ? announcement.departmentName
                    : t('adminNotices.form.ownDepartment', {
                        department: ownDepartmentName ?? '—',
                      })}
                </p>
                {announcement ? (
                  <p className="text-sm text-muted">{t('adminNotices.form.departmentFixed')}</p>
                ) : null}
              </div>
            )}

            <Field
              label={t('adminNotices.form.neighborhood')}
              hint={t('adminNotices.form.neighborhoodHint')}
              error={errors.neighborhoodId}
            >
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  name="neighborhoodId"
                  defaultValue={typed?.neighborhoodId ?? announcement?.neighborhoodId ?? ''}
                  aria-describedby={describedBy}
                  invalid={invalid}
                >
                  <option value="">{t('adminNotices.form.allNeighborhoods')}</option>
                  {neighborhoods.map((neighborhood) => (
                    <option key={neighborhood.id} value={neighborhood.id}>
                      {neighborhood.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-5">
            {announcement?.hasImage && !preview ? (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {t('adminNotices.form.currentImage')}
                </span>
                {announcement.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                  <img
                    src={announcement.imageUrl}
                    alt=""
                    className={cn(
                      'max-h-56 w-fit max-w-full rounded-lg border border-border object-contain shadow-xs transition-opacity',
                      removeImage && 'opacity-40 grayscale',
                    )}
                  />
                ) : null}
                <label className="flex w-fit cursor-pointer items-center gap-2 rounded-sm text-sm text-danger">
                  <input
                    type="checkbox"
                    name="removeImage"
                    value="true"
                    checked={removeImage}
                    onChange={(event) => setRemoveImage(event.target.checked)}
                    className="size-4 accent-[var(--color-primary)]"
                  />
                  {t('adminNotices.form.removeImage')}
                </label>
              </div>
            ) : null}

            {!removeImage ? (
              <Field
                label={
                  announcement?.hasImage
                    ? t('adminNotices.form.replaceImage')
                    : t('adminNotices.form.image')
                }
                hint={t('adminNotices.form.imageHint')}
                error={imageError ?? errors.image}
              >
                {({ id, describedBy, invalid }) => (
                  <input
                    id={id}
                    name="image"
                    type="file"
                    accept={ANNOUNCEMENT_IMAGE_TYPES.join(',')}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    className={cn(
                      'w-full cursor-pointer rounded-lg border border-dashed border-border-strong bg-surface-subtle p-2.5 text-sm text-muted transition-colors',
                      'hover:border-primary hover:bg-primary-soft focus-visible:ring-4 focus-visible:ring-focus-ring focus-visible:outline-none',
                      'file:me-3 file:cursor-pointer file:rounded-md file:border file:border-border-strong file:bg-surface',
                      'file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground file:shadow-xs',
                      invalid && 'border-danger',
                    )}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      const problem = file ? announcementImageProblem(file) : null;
                      setImageError(
                        problem === 'type'
                          ? t('adminNotices.form.imageType')
                          : problem === 'size'
                            ? t('adminNotices.form.imageSize')
                            : null,
                      );
                      if (problem) event.target.value = '';
                      setPreview(file && !problem ? URL.createObjectURL(file) : null);
                    }}
                  />
                )}
              </Field>
            ) : null}
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img
                src={preview}
                alt=""
                className="max-h-56 w-fit max-w-full animate-fade-in rounded-lg border border-border object-contain shadow-xs"
              />
            ) : null}
          </div>

          {!editing ? (
            canPublishOwn ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-subtle p-4 transition-colors hover:border-border-strong has-checked:border-primary has-checked:bg-primary-soft">
                <input
                  type="checkbox"
                  name="publish"
                  value="true"
                  defaultChecked={typed ? typed.publish === 'true' : true}
                  className="mt-1 size-4 accent-[var(--color-primary)]"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {t('adminNotices.form.publishNow')}
                  </span>
                  <span className="text-sm text-muted">
                    {t('adminNotices.form.publishNowHint')}
                  </span>
                </span>
              </label>
            ) : (
              <Alert tone="info">{t('adminNotices.form.draftOnlyNotice')}</Alert>
            )
          ) : null}

          <SubmitButton
            variant="primary"
            size="lg"
            className="w-full"
            icon={editing ? 'check' : 'send'}
            pendingLabel={t('adminNotices.form.creating')}
          >
            {editing ? t('adminNotices.form.save') : t('adminNotices.form.create')}
          </SubmitButton>
        </aside>
      </div>
    </form>
  );
}

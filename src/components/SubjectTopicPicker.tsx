import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useSubjects } from '@/lib/hooks';
import { Select } from './ui/select';
import { Field } from './common';

export interface PickerValue {
  subjectId?: number;
  topicId?: number;
}

/** Subject → topic (grouped by unit). Topic is optional unless requireTopic. */
export function SubjectTopicPicker({
  value,
  onChange,
  requireTopic = false,
  hideTopic = false,
}: {
  value: PickerValue;
  onChange: (v: PickerValue) => void;
  requireTopic?: boolean;
  hideTopic?: boolean;
}) {
  const subjects = useSubjects() ?? [];
  const data = useLiveQuery(async () => {
    if (!value.subjectId) return { units: [], topics: [] };
    const [units, topics] = await Promise.all([
      db.units.where('subjectId').equals(value.subjectId).sortBy('order'),
      db.topics.where('subjectId').equals(value.subjectId).sortBy('order'),
    ]);
    return { units, topics };
  }, [value.subjectId]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Course">
        <Select
          value={value.subjectId ?? ''}
          onChange={(e) => onChange({ subjectId: e.target.value ? Number(e.target.value) : undefined, topicId: undefined })}
        >
          <option value="">Choose course…</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      {!hideTopic && (
        <Field label={requireTopic ? 'Topic' : 'Topic (optional)'}>
          <Select
            value={value.topicId ?? ''}
            disabled={!value.subjectId}
            onChange={(e) => onChange({ ...value, topicId: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">{requireTopic ? 'Choose topic…' : 'Whole course'}</option>
            {data?.units.map((u) => (
              <optgroup key={u.id} label={u.name}>
                {data.topics
                  .filter((t) => t.unitId === u.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </Field>
      )}
    </div>
  );
}

const LAST_KEY = 'studyos.lastPick';

export function loadLastPick(): PickerValue {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function saveLastPick(v: PickerValue) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable — fine */
  }
}

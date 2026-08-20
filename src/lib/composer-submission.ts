import type { Attachment } from './api';

export type ComposerSubmissionState = {
  attachments: Attachment[];
  resetEpoch: number;
  submitting: boolean;
};

/**
 * A request starts by adding its optimistic chat rows.  Keep the composer
 * attachment subtree intact for that render so Fabric never has to recycle a
 * TextInput while also moving the attachment from composer to message list.
 */
export function beginComposerSubmission(state: ComposerSubmissionState): ComposerSubmissionState {
  return { ...state, submitting: true };
}

/**
 * The bridge accepted the request. Clear visible draft data in the following
 * render while keeping the in-flight lock until the reply settles.
 */
export function acceptComposerSubmission(state: ComposerSubmissionState): ComposerSubmissionState {
  return { attachments: [], resetEpoch: state.resetEpoch + 1, submitting: true };
}

/** The reply settled; only unlock because the composer was already cleared. */
export function finishComposerSubmission(state: ComposerSubmissionState): ComposerSubmissionState {
  return { ...state, submitting: false };
}

import { getConfig, camelCaseObject } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient, getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { logInfo } from '@edx/frontend-platform/logging';

export function normalizeBlocks(courseId, blocks) {
  const models = {
    courses: {},
    sections: {},
    sequences: {},
    units: {},
  };
  Object.values(blocks).forEach(block => {
    switch (block.type) {
      case 'course':
        models.courses[block.id] = {
          id: courseId,
          title: block.display_name,
          sectionIds: block.children || [],
        };
        break;
      case 'chapter':
        models.sections[block.id] = {
          id: block.id,
          title: block.display_name,
          sequenceIds: block.children || [],
        };
        break;

      case 'sequential':
        models.sequences[block.id] = {
          id: block.id,
          title: block.display_name,
          lmsWebUrl: block.lms_web_url,
          unitIds: block.children || [],
        };
        break;
      case 'vertical':
        models.units[block.id] = {
          graded: block.graded,
          id: block.id,
          title: block.display_name,
          lmsWebUrl: block.lms_web_url,
        };
        break;
      default:
        logInfo(`Unexpected course block type: ${block.type} with ID ${block.id}.  Expected block types are course, chapter, sequential, and vertical.`);
    }
  });

  // Next go through each list and use their child lists to decorate those children with a
  // reference back to their parent.
  Object.values(models.courses).forEach(course => {
    if (Array.isArray(course.sectionIds)) {
      course.sectionIds.forEach(sectionId => {
        const section = models.sections[sectionId];
        section.courseId = course.id;
      });
    }
  });

  Object.values(models.sections).forEach(section => {
    if (Array.isArray(section.sequenceIds)) {
      section.sequenceIds.forEach(sequenceId => {
        if (sequenceId in models.sequences) {
          models.sequences[sequenceId].sectionId = section.id;
        } else {
          logInfo(`Section ${section.id} has child block ${sequenceId}, but that block is not in the list of sequences.`);
        }
      });
    }
  });

  Object.values(models.sequences).forEach(sequence => {
    if (Array.isArray(sequence.unitIds)) {
      sequence.unitIds.forEach(unitId => {
        if (unitId in models.units) {
          models.units[unitId].sequenceId = sequence.id;
        } else {
          logInfo(`Sequence ${sequence.id} has child block ${unitId}, but that block is not in the list of units.`);
        }
      });
    }
  });

  return models;
}

export async function getCourseBlocks(courseId) {
  const { username } = getAuthenticatedUser();
  const url = new URL(`${getConfig().LMS_BASE_URL}/api/courses/v2/blocks/`);
  url.searchParams.append('course_id', courseId);
  url.searchParams.append('username', username);
  url.searchParams.append('depth', 3);
  url.searchParams.append('requested_fields', 'children,show_gated_sections,graded,special_exam_info');

  const { data } = await getAuthenticatedHttpClient().get(url.href, {});
  return normalizeBlocks(courseId, data.blocks);
}

function normalizeTabUrls(id, tabs) {
  // If api doesn't return the mfe base url, change tab url to point back to LMS
  return tabs.map((tab) => {
    let { url } = tab;
    if (url[0] === '/') {
      url = `${getConfig().LMS_BASE_URL}${tab.url}`;
    }
    return { ...tab, url };
  });
}

function normalizeMetadata(metadata) {
  return {
    canShowUpgradeSock: metadata.can_show_upgrade_sock,
    contentTypeGatingEnabled: metadata.content_type_gating_enabled,
    // TODO: TNL-7185: return course expired _date_, instead of _message_
    courseExpiredMessage: metadata.course_expired_message,
    id: metadata.id,
    title: metadata.name,
    number: metadata.number,
    offerHtml: metadata.offer_html,
    org: metadata.org,
    enrollmentStart: metadata.enrollment_start,
    enrollmentEnd: metadata.enrollment_end,
    end: metadata.end,
    start: metadata.start,
    enrollmentMode: metadata.enrollment.mode,
    isEnrolled: metadata.enrollment.is_active,
    canLoadCourseware: camelCaseObject(metadata.can_load_courseware),
    originalUserIsStaff: metadata.original_user_is_staff,
    isStaff: metadata.is_staff,
    license: metadata.license,
    verifiedMode: camelCaseObject(metadata.verified_mode),
    tabs: normalizeTabUrls(metadata.id, camelCaseObject(metadata.tabs)),
    showCalculator: metadata.show_calculator,
    notes: camelCaseObject(metadata.notes),
    marketingUrl: metadata.marketing_url,
    celebrations: camelCaseObject(metadata.celebrations),
    userHasPassingGrade: metadata.user_has_passing_grade,
    courseExitPageIsActive: metadata.course_exit_page_is_active,
    certificateData: camelCaseObject(metadata.certificate_data),
    verifyIdentityUrl: metadata.verify_identity_url,
    linkedinAddToProfileUrl: metadata.linkedin_add_to_profile_url,
  };
}

export async function getCourseMetadata(courseId) {
  const url = `${getConfig().LMS_BASE_URL}/api/courseware/course/${courseId}`;
  const { data } = await getAuthenticatedHttpClient().get(url);
  return normalizeMetadata(data);
}

function normalizeSequenceMetadata(sequence) {
  return {
    sequence: {
      id: sequence.item_id,
      unitIds: sequence.items.map(unit => unit.id),
      bannerText: sequence.banner_text,
      format: sequence.format,
      title: sequence.display_name,
      gatedContent: camelCaseObject(sequence.gated_content),
      isTimeLimited: sequence.is_time_limited,
      // Position comes back from the server 1-indexed. Adjust here.
      activeUnitIndex: sequence.position ? sequence.position - 1 : 0,
      saveUnitPosition: sequence.save_position,
      showCompletion: sequence.show_completion,
    },
    units: sequence.items.map(unit => ({
      id: unit.id,
      sequenceId: sequence.item_id,
      bookmarked: unit.bookmarked,
      complete: unit.complete,
      title: unit.page_title,
      contentType: unit.type,
    })),
  };
}

export async function getSequenceMetadata(sequenceId) {
  const { data } = await getAuthenticatedHttpClient()
    .get(`${getConfig().LMS_BASE_URL}/api/courseware/sequence/${sequenceId}`, {});

  return normalizeSequenceMetadata(data);
}

const getSequenceXModuleHandlerUrl = (courseId, sequenceId) => `${getConfig().LMS_BASE_URL}/courses/${courseId}/xblock/${sequenceId}/handler/xmodule_handler`;

export async function getBlockCompletion(courseId, sequenceId, usageKey) {
  // Post data sent to this endpoint must be url encoded
  // TODO: Remove the need for this to be the case.
  // TODO: Ensure this usage of URLSearchParams is working in Internet Explorer
  const urlEncoded = new URLSearchParams();
  urlEncoded.append('usage_key', usageKey);
  const requestConfig = {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  };

  const { data } = await getAuthenticatedHttpClient().post(
    `${getSequenceXModuleHandlerUrl(courseId, sequenceId)}/get_completion`,
    urlEncoded.toString(),
    requestConfig,
  );

  if (data.complete) {
    return true;
  }

  return false;
}

export async function postSequencePosition(courseId, sequenceId, activeUnitIndex) {
  // Post data sent to this endpoint must be url encoded
  // TODO: Remove the need for this to be the case.
  // TODO: Ensure this usage of URLSearchParams is working in Internet Explorer
  const urlEncoded = new URLSearchParams();
  // Position is 1-indexed on the server and 0-indexed in this app. Adjust here.
  urlEncoded.append('position', activeUnitIndex + 1);
  const requestConfig = {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  };

  const { data } = await getAuthenticatedHttpClient().post(
    `${getSequenceXModuleHandlerUrl(courseId, sequenceId)}/goto_position`,
    urlEncoded.toString(),
    requestConfig,
  );

  return data;
}

export async function getResumeBlock(courseId) {
  const url = new URL(`${getConfig().LMS_BASE_URL}/api/courseware/resume/${courseId}`);
  const { data } = await getAuthenticatedHttpClient().get(url.href, {});
  return camelCaseObject(data);
}

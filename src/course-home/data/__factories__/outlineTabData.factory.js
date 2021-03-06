import { Factory } from 'rosie'; // eslint-disable-line import/no-extraneous-dependencies

import buildSimpleCourseBlocks from './courseBlocks.factory';

Factory.define('outlineTabData')
  .option('courseId', 'course-v1:edX+DemoX+Demo_Course')
  .option('host', 'http://localhost:18000')
  .option('dateBlocks', [])
  .attr('course_tools', ['host', 'courseId'], (host, courseId) => ([{
    analytics_id: 'edx.bookmarks',
    title: 'Bookmarks',
    url: `${host}/courses/${courseId}/bookmarks/`,
  }]))
  .attr('course_blocks', ['courseId'], courseId => {
    const { courseBlocks } = buildSimpleCourseBlocks(courseId);
    return {
      blocks: courseBlocks.blocks,
    };
  })
  .attr('dates_widget', ['dateBlocks'], (dateBlocks) => ({
    course_date_blocks: dateBlocks,
    user_timezone: 'UTC',
  }))
  .attr('resume_course', ['host', 'courseId'], (host, courseId) => ({
    has_visited_course: false,
    url: `${host}/courses/${courseId}/jump_to/block-v1:edX+Test+Block@12345abcde`,
  }))
  .attrs({
    course_expired_html: null,
    course_goals: {
      goal_options: [],
      selected_goal: null,
    },
    dates_banner_info: {
      content_type_gating_enabled: false,
      missed_gated_content: false,
      missed_deadlines: false,
    },
    enroll_alert: {
      can_enroll: true,
      extra_text: 'Contact the administrator.',
    },
    handouts_html: '<ul><li>Handout 1</li></ul>',
    offer_html: null,
    welcome_message_html: '<p>Welcome to this course!</p>',
  });

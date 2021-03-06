import React from 'react';
import { useSelector } from 'react-redux';
import { injectIntl, intlShape } from '@edx/frontend-platform/i18n';

import messages from './messages';
import Timeline from './Timeline';
import DatesBannerContainer from '../dates-banner/DatesBannerContainer';

import { useModel } from '../../generic/model-store';

function DatesTab({ intl }) {
  const {
    courseId,
  } = useSelector(state => state.courseHome);

  const {
    courseDateBlocks,
    datesBannerInfo,
    hasEnded,
  } = useModel('dates', courseId);

  return (
    <>
      <div role="heading" aria-level="1" className="h4 my-3">
        {intl.formatMessage(messages.title)}
      </div>
      <DatesBannerContainer
        courseDateBlocks={courseDateBlocks}
        datesBannerInfo={datesBannerInfo}
        hasEnded={hasEnded}
        model="dates"
      />
      <Timeline />
    </>
  );
}

DatesTab.propTypes = {
  intl: intlShape.isRequired,
};

export default injectIntl(DatesTab);

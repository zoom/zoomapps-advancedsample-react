/* globals zoomSdk */

import Select from "react-select";
import React, { useCallback, useEffect, useState } from "react";

function MultiSelect({ showMulti, setSelected, selected, onSendMulti }) {
  const [participants, setParticipants] = useState([]);

  const submitInvitation = useCallback(() => {
    async function submitInvitation() {
      try {
        await zoomSdk.callZoomApi("getMeetingParticipants");
        console.log(selected);
        console.log(selected.map((person) => person.value));
        await zoomSdk.callZoomApi("sendAppInvitation", {
          user_list: selected.map((person) => person.value),
        });
      } catch (error) {
        console.error(error);
      }
    }

    submitInvitation();
  }, [selected]);

  useEffect(() => {
    zoomSdk.callZoomApi("getMeetingParticipants")
      .then((participantData) => {
        const participantsArr = participantData.participants.map(
          (participant) => ({
            role: participant.role,
            label: participant.screenName,
            value: participant.participantId,
          })
        );
        setParticipants(participantsArr);
      })
      .catch(e => console.log('MultiSelect component tried to getMeetingParticipants but failed with error: ', e))

  }, []);

  if (!participants) return <div>Loading participants ...</div>;

  if (!showMulti) return <div />;

  return (
    <div>
      <Select
        isMulti
        isClearable
        options={participants}
        onChange={setSelected}
        value={selected}
        backspaceRemovesValue
      />
      <button type="submit" onClick={submitInvitation}>
        SendMulti
      </button>
    </div>
  );
}

export default MultiSelect;

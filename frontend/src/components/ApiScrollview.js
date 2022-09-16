import { React, useState } from 'react';
import Button from "react-bootstrap/Button";
import { apis, invokeZoomAppsSdk } from "../apis";
import "./ApiScrollview.css";

function ApiScrollview() {
  const [apiSearchText, setApiSearchText] = useState("");

  const searchHandler = (e) => {
    let lowerCase = e.target.value.toLowerCase();
    setApiSearchText(lowerCase);
  };

  const filteredApis = apis?.filter((api) => {
    if (apiSearchText === '') {
      return api;
    } else {
      return api.name.toLowerCase().includes(apiSearchText);
    }
  });

  return (
    <div className="api-scrollview">
      <input placeholder="Search for an API"
        onChange={searchHandler}
        label="Search"
        id="api-scrollview-input"
      />

      <div className="api-buttons-list">
        {filteredApis?.map(api =>
          <Button onClick={invokeZoomAppsSdk(api)}
            className="api-button"
            key={api.buttonName ||
              api.name} > {api.buttonName || api.name}
          </Button>
        )}

      </div>
      <hr className="hr-scroll-border"></hr>

    </div>
  )
}

export default ApiScrollview

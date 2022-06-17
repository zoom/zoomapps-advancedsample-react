function IFrame() {
  return (
    <iframe
      title="iframe-example"
      src={`${process.env.REACT_APP_PUBLIC_ROOT}/hello`}
    ></iframe>
  );
}

export default IFrame;

function IFrame() {
  return (
    <iframe
      title="iframe-example"
      height="300px"
      width="100%"
      src={`${process.env.REACT_APP_PUBLIC_ROOT}/hello`}
    />
  );
}

export default IFrame;

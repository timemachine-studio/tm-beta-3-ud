export interface Theme {
  name: string;
  background: string;
  text: string;
  border: string;
  input: {
    background: string;
    text: string;
    placeholder: string;
    border: string;
  };
  button: {
    primary: string;
    secondary: string;
  };
  modal: {
    background: string;
    overlay: string;
  };
  dropdown: {
    background: string;
    hover: string;
  };
  card: {
    background: string;
    border: string;
  };
  glow: {
    primary: string;
    secondary: string;
  };
}
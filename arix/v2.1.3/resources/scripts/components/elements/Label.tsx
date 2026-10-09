import styled from 'styled-components/macro';
import tw from 'twin.macro';

const Label = styled.label<{ isLight?: boolean }>`
    ${tw`block text-sm text-gray-300 mb-1`};
    ${(props) => props.isLight && tw`text-neutral-700`};
`;

export default Label;

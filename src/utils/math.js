function divide (denominator) {
  return (numerator) => {
    return numerator / denominator
  }
}

export const half = divide(2)

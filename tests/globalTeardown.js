module.exports = async () => {
  const { sequelize } = require('../server');
  await sequelize.close();
};
